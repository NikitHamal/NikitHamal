/**
 * Blogger API Configuration
 * 
 * To get your Blog ID:
 * 1. Go to your Blogger Dashboard (https://www.blogger.com)
 * 2. Select the blog you want to use.
 * 3. Look at the URL in your browser. It should look like:
 *    https://www.blogger.com/blog/posts/YOUR_BLOG_ID_HERE
 */
const BLOGGER_CONFIG = {
    apiKey: 'YOUR_API_KEY_HERE', // Paste your API Key here
    blogId: 'YOUR_BLOG_ID_HERE', // Paste your Blog ID here
};

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BLOGGER_CONFIG;
} else {
    window.BLOGGER_CONFIG = BLOGGER_CONFIG;
}
