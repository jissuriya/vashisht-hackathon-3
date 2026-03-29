const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, searchStr, replaceStr) {
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        content = content.replace(searchStr, replaceStr);
        fs.writeFileSync(filePath, content, 'utf8');
    }
}

function replaceAllInFile(filePath, searchPattern, replaceStr) {
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        content = content.replace(new RegExp(searchPattern, 'g'), replaceStr);
        fs.writeFileSync(filePath, content, 'utf8');
    }
}

// 1. Root Links
replaceInFile('index.html', 'src="app.js"', 'src="js/app.js"');
replaceInFile('auth.html', 'src="app.js"', 'src="js/app.js"');
replaceInFile('auth.html', 'src="auth.js"', 'src="js/auth.js"');

// 2. Auth JS Redirect
replaceInFile('js/auth.js', '-dashboard.html', 'dashboards/{user.role}-dashboard.html');

// 3. App JS Redirect (Logout)
replaceInFile('js/app.js', 'window.location.href = \'auth.html\';', 'window.location.href = window.location.pathname.includes(\'dashboards/\') ? \'../auth.html\' : \'auth.html\';');

// 4. Dashboard JS Redirects
['donor', 'receiver', 'volunteer'].forEach(role => {
    const jsPath = 'js/' + role + '-dashboard.js';
    replaceInFile(jsPath, 'window.location.href = \'auth.html\';', 'window.location.href = \'../auth.html\';');
    
    // Replace URL paths in HTML
    const htmlPath = 'dashboards/' + role + '-dashboard.html';
    replaceInFile(htmlPath, 'href="styles.css"', 'href="../styles.css"');
    replaceInFile(htmlPath, 'href="index.html"', 'href="../index.html"');
    replaceInFile(htmlPath, 'src="app.js"', 'src="../js/app.js"');
    replaceInFile(htmlPath, 'src="' + role + '-dashboard.js"', 'src="../js/' + role + '-dashboard.js"');
});

console.log('Update paths completed for ' + process.cwd());
