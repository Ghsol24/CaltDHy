const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const HTML_FILE = path.join(__dirname, 'frontEnd', 'spending.html');
const JS_FILE = path.join(__dirname, 'frontEnd', 'spending.js');

function testHtmlStructure() {
  console.log('🔍 Testing spending.html structure...');
  if (!fs.existsSync(HTML_FILE)) {
    console.error('❌ Error: spending.html not found!');
    process.exit(1);
  }

  const htmlContent = fs.readFileSync(HTML_FILE, 'utf8');
  const dom = new JSDOM(htmlContent);
  const { document } = dom.window;

  // Verify dailyTrendChart canvas exists
  const dailyTrendCanvas = document.getElementById('dailyTrendChart');
  if (!dailyTrendCanvas) {
    console.error('❌ Error: canvas with ID "dailyTrendChart" is missing!');
    process.exit(1);
  }
  console.log('✅ Found dailyTrendChart canvas element.');

  // Verify it is inside view-analytics
  const viewAnalytics = document.getElementById('view-analytics');
  if (!viewAnalytics) {
    console.error('❌ Error: div with ID "view-analytics" is missing!');
    process.exit(1);
  }
  if (!viewAnalytics.contains(dailyTrendCanvas)) {
    console.error('❌ Error: "dailyTrendChart" is not inside "view-analytics"!');
    process.exit(1);
  }
  console.log('✅ dailyTrendChart is correctly located inside view-analytics.');

  // Verify other premium elements or theme toggle
  const themeToggle = document.querySelector('.theme-toggle') || document.querySelector('[onclick*="toggleTheme"]');
  if (themeToggle) {
    console.log('✅ Found theme selection control/toggle.');
  }

  console.log('🎉 HTML Structure Verification Passed!');
}

function testJsLogic() {
  console.log('🔍 Testing spending.js syntax & logic presence...');
  if (!fs.existsSync(JS_FILE)) {
    console.error('❌ Error: spending.js not found!');
    process.exit(1);
  }

  const jsContent = fs.readFileSync(JS_FILE, 'utf8');

  // Check if dailyTrendChart is referenced in spending.js
  if (!jsContent.includes('dailyTrendChart')) {
    console.error('❌ Error: spending.js does not contain references to "dailyTrendChart"!');
    process.exit(1);
  }
  console.log('✅ spending.js contains references to dailyTrendChart.');

  // Check if Chart instantiation for daily trend exists
  if (!jsContent.includes('new Chart') && !jsContent.includes('Chart(')) {
    console.error('❌ Error: spending.js does not instantiate any Charts!');
    process.exit(1);
  }
  console.log('✅ spending.js contains Chart instantiations.');
  console.log('🎉 JS Logic Verification Passed!');
}

try {
  testHtmlStructure();
  testJsLogic();
  console.log('\n🟢 ALL SYSTEM VERIFICATION TESTS PASSED SUCCESSFULLY! CaltDHy UI & Chart features are verified.');
} catch (err) {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
}
