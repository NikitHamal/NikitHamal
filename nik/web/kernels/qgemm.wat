;; Nik int8 GEMM kernel (WASM SIMD128).
;;   Y[t, o] = ws[o] * xs[t] * sum_i W[o, i] * X[t, i]
;; W: int8 out x in (row-major), X: int8 T x in (per-token quantised), in % 16 == 0.
;; Two tokens per weight-row load (register blocking), 16 int8 MACs per step via
;; sign-extension to i16 and i32x4.dot_i16x8_s.
(module
  (memory (export "mem") 256)
  (func $hsum (param $v v128) (result i32)
    (i32.add
      (i32.add (i32x4.extract_lane 0 (local.get $v)) (i32x4.extract_lane 1 (local.get $v)))
      (i32.add (i32x4.extract_lane 2 (local.get $v)) (i32x4.extract_lane 3 (local.get $v)))))

  (func (export "qgemm")
    (param $x i32) (param $xs i32) (param $T i32)
    (param $w i32) (param $ws i32) (param $in i32) (param $out i32) (param $y i32)
    (local $o i32) (local $t i32) (local $i i32) (local $wr i32) (local $x0 i32) (local $x1 i32)
    (local $wv v128) (local $wl v128) (local $wh v128) (local $a0 v128) (local $a1 v128) (local $xv v128)
    (local $sw f32)
    (local.set $o (i32.const 0))
    (block $done_o (loop $lo
      (br_if $done_o (i32.ge_u (local.get $o) (local.get $out)))
      (local.set $wr (i32.add (local.get $w) (i32.mul (local.get $o) (local.get $in))))
      (local.set $sw (f32.load (i32.add (local.get $ws) (i32.shl (local.get $o) (i32.const 2)))))
      (local.set $t (i32.const 0))
      ;; pairs of tokens
      (block $done_t2 (loop $lt2
        (br_if $done_t2 (i32.gt_s (i32.add (local.get $t) (i32.const 2)) (local.get $T)))
        (local.set $x0 (i32.add (local.get $x) (i32.mul (local.get $t) (local.get $in))))
        (local.set $x1 (i32.add (local.get $x0) (local.get $in)))
        (local.set $a0 (v128.const i32x4 0 0 0 0))
        (local.set $a1 (v128.const i32x4 0 0 0 0))
        (local.set $i (i32.const 0))
        (block $done_i (loop $li
          (br_if $done_i (i32.ge_u (local.get $i) (local.get $in)))
          (local.set $wv (v128.load (i32.add (local.get $wr) (local.get $i))))
          (local.set $wl (i16x8.extend_low_i8x16_s (local.get $wv)))
          (local.set $wh (i16x8.extend_high_i8x16_s (local.get $wv)))
          (local.set $xv (v128.load (i32.add (local.get $x0) (local.get $i))))
          (local.set $a0 (i32x4.add (local.get $a0) (i32x4.add
            (i32x4.dot_i16x8_s (local.get $wl) (i16x8.extend_low_i8x16_s (local.get $xv)))
            (i32x4.dot_i16x8_s (local.get $wh) (i16x8.extend_high_i8x16_s (local.get $xv))))))
          (local.set $xv (v128.load (i32.add (local.get $x1) (local.get $i))))
          (local.set $a1 (i32x4.add (local.get $a1) (i32x4.add
            (i32x4.dot_i16x8_s (local.get $wl) (i16x8.extend_low_i8x16_s (local.get $xv)))
            (i32x4.dot_i16x8_s (local.get $wh) (i16x8.extend_high_i8x16_s (local.get $xv))))))
          (local.set $i (i32.add (local.get $i) (i32.const 16)))
          (br $li)))
        (f32.store
          (i32.add (local.get $y) (i32.shl (i32.add (i32.mul (local.get $t) (local.get $out)) (local.get $o)) (i32.const 2)))
          (f32.mul (f32.mul (f32.convert_i32_s (call $hsum (local.get $a0))) (local.get $sw))
                   (f32.load (i32.add (local.get $xs) (i32.shl (local.get $t) (i32.const 2))))))
        (f32.store
          (i32.add (local.get $y) (i32.shl (i32.add (i32.mul (i32.add (local.get $t) (i32.const 1)) (local.get $out)) (local.get $o)) (i32.const 2)))
          (f32.mul (f32.mul (f32.convert_i32_s (call $hsum (local.get $a1))) (local.get $sw))
                   (f32.load (i32.add (local.get $xs) (i32.shl (i32.add (local.get $t) (i32.const 1)) (i32.const 2))))))
        (local.set $t (i32.add (local.get $t) (i32.const 2)))
        (br $lt2)))
      ;; odd tail token
      (if (i32.lt_s (local.get $t) (local.get $T)) (then
        (local.set $x0 (i32.add (local.get $x) (i32.mul (local.get $t) (local.get $in))))
        (local.set $a0 (v128.const i32x4 0 0 0 0))
        (local.set $i (i32.const 0))
        (block $done_j (loop $lj
          (br_if $done_j (i32.ge_u (local.get $i) (local.get $in)))
          (local.set $wv (v128.load (i32.add (local.get $wr) (local.get $i))))
          (local.set $xv (v128.load (i32.add (local.get $x0) (local.get $i))))
          (local.set $a0 (i32x4.add (local.get $a0) (i32x4.add
            (i32x4.dot_i16x8_s (i16x8.extend_low_i8x16_s (local.get $wv)) (i16x8.extend_low_i8x16_s (local.get $xv)))
            (i32x4.dot_i16x8_s (i16x8.extend_high_i8x16_s (local.get $wv)) (i16x8.extend_high_i8x16_s (local.get $xv))))))
          (local.set $i (i32.add (local.get $i) (i32.const 16)))
          (br $lj)))
        (f32.store
          (i32.add (local.get $y) (i32.shl (i32.add (i32.mul (local.get $t) (local.get $out)) (local.get $o)) (i32.const 2)))
          (f32.mul (f32.mul (f32.convert_i32_s (call $hsum (local.get $a0))) (local.get $sw))
                   (f32.load (i32.add (local.get $xs) (i32.shl (local.get $t) (i32.const 2))))))))
      (local.set $o (i32.add (local.get $o) (i32.const 1)))
      (br $lo)))
  )
)
