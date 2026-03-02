'use strict';

console.log('START TIME:', new Date());

const { src, dest, watch, series, parallel } = require('gulp');
const path = require('path');
const fs = require('fs');
const { deleteAsync } = require('del');
const browserSync = require('browser-sync').create();

const pug = require('gulp-pug');
const sass = require('gulp-sass')(require('sass'));
const sourcemaps = require('gulp-sourcemaps');
const autoprefixer = require('gulp-autoprefixer').default;
const cleanCSS = require('gulp-clean-css');
const terser = require('gulp-terser');
const rename = require('gulp-rename');
const includer = require('gulp-x-includer');
const through2 = require('through2');
const rev = require('gulp-rev').default;
const newer = require('gulp-newer');
const plumber = require('gulp-plumber');
const sharp = require('sharp');
const revRewrite = require('gulp-rev-rewrite').default;
const notify = require('gulp-notify'); // сообщения при ошибках
const gcmq = require('gulp-group-css-media-queries');
const svgSprite = require('gulp-svg-sprite');

const isProd = process.argv.includes('--prod');

// ======================
// PROJECT SELECTION
// ======================

const projectArg = process.argv.find(arg => arg.startsWith('--project='));

if (!projectArg) {
	throw new Error('Укажи проект: gulp --project=project-name');
}

const project = projectArg.split('=')[1];
const root = 'D:/verstka/';
const projectRoot = path.join(root, project);

console.log('PROJECT ROOT:', projectRoot);

// ======================
// CONFIG (ТОЛЬКО ОТНОСИТЕЛЬНЫЕ ПУТИ)
// ======================

const config = {
	html: {
		src: 'src/pug/pages/index.pug',
		watch: 'src/pug/**/*.pug',
		dest: 'dist'
	},
	styles: {
		src: 'src/sass/**/*.+(scss|sass)',
		dest: 'dist/css/',
		root: 'src/sass/'
	},
	js: {
		common: 'src/js/common.js',
		libs: 'src/libs/libs-includ.js',
		watch: 'src/js/**/*.js',
		dest: 'dist/js/'
	},
	images: {
		src: 'src/assets/images/**/*.{jpg,jpeg,png}',
		watch: 'src/assets/images/**/*.{jpg,jpeg,png}',
		dest: 'dist/assets/images/'
	},
	svg: {
		src: 'src/assets/icons/**/*.svg',
		watch: 'src/assets/icons/**/*.svg',
		dest: 'dist/assets/icons/'
	},
	fonts: {
		src: 'src/assets/fonts/**/*.woff2',
		dest: 'dist/assets/fonts/'
	}
};

const svgConfig = {
	mode: {
		symbol: {
			sprite: "sprite.svg",
			example: false
		}
	},
	shape: {
		transform: [
			{
				svgo: {
					plugins: [
						{ name: "removeViewBox", active: false },
						{ name: "removeDimensions", active: true }
					]
				}
			}
		]
	}
};

// ======================
// CLEAN
// ======================

function clean() {
	return deleteAsync([path.join(projectRoot, 'dist')], { force: true });
}

// ======================
// SERVER
// ======================

function server() {
	browserSync.init({
		server: { baseDir: path.join(projectRoot, 'dist') },
		notify: false
	});
}

// ======================
// HTML
// ======================

function html() {

	const manifestPath = path.join(projectRoot, 'dist/rev/rev-manifest.json');

	return src(config.html.src, { cwd: projectRoot })
		.pipe(plumber())
		.pipe(pug({ pretty: !isProd }))
		.on(
			'error',
			notify.onError(function (error) {
				return 'Ошибка в pug: ' + error.message;
			})
		)

		// 1️⃣ В проде меняем png/jpg → webp
		.pipe(isProd
			? through2.obj(function (file, _, cb) {
				if (file.isBuffer()) {
					let contents = file.contents.toString();

					contents = contents.replace(
						/assets\/images\/(.*)\.(png|jpg|jpeg)/g,
						'assets/images/$1.webp'
					);

					file.contents = Buffer.from(contents);
				}
				cb(null, file);
			})
			: through2.obj()
		)

		// 2️⃣ Затем применяем revRewrite
		.pipe(isProd && fs.existsSync(manifestPath)
			? revRewrite({
				manifest: fs.readFileSync(manifestPath),
				modifyUnreved: filename => filename.replace(/^\//, ''),
				modifyReved: filename => '/' + filename
			})
			: through2.obj()
		)

		.pipe(dest(config.html.dest, { cwd: projectRoot }))
		.pipe(browserSync.stream());
}

// ======================
// STYLES
// ======================

function styles() {
	return src(config.styles.src, { cwd: projectRoot })
		.pipe(plumber())
		.pipe(!isProd ? sourcemaps.init() : through2.obj())
		.pipe(sass().on('error', notify.onError()))
		.pipe(autoprefixer({ cascade: false, flexbox: 'no-2009' }))
		.pipe(isProd ? cleanCSS({ level: 2 }) : through2.obj())
		.pipe(isProd ? gcmq() : through2.obj()) 
		.pipe(rename({ suffix: '.min' }))
		.pipe(!isProd ? sourcemaps.write('.') : through2.obj())
		.pipe(dest(config.styles.dest, { cwd: projectRoot }))
		.pipe(browserSync.stream());
}

// ======================
// JS
// ======================

function commonJs() {
	return src(config.js.common, { cwd: projectRoot })
		.pipe(plumber())
		.pipe(includer())
		.pipe(isProd ? terser() : through2.obj())
		.pipe(rename({ suffix: '.min' }))
		.pipe(dest(config.js.dest, { cwd: projectRoot }));
}

function libsJs() {
	return src(config.js.libs, { cwd: projectRoot })
		.pipe(plumber())
		.pipe(includer())
		.pipe(isProd ? terser() : through2.obj())
		.pipe(rename('scripts.min.js'))
		.pipe(dest(config.js.dest, { cwd: projectRoot }))
		.pipe(browserSync.stream());
}

// ======================
// IMAGES
// ======================

function images() {

	if (!isProd) {

		return src('src/assets/images/**/*.{jpg,jpeg,png}', {
			cwd: projectRoot,
			encoding: false
		})
			.pipe(dest('dist/assets/images', { cwd: projectRoot }))
			.pipe(browserSync.stream());
	}

	return src(config.images.src, {
		cwd: projectRoot,
		base: path.join(projectRoot, 'src/assets/images'),
		encoding: false
	})
		.pipe(newer(path.join(projectRoot, 'dist')))
		.pipe(through2.obj(function (file, _, cb) {

			if (!file.isBuffer()) return cb(null, file);

			sharp(file.contents)
				.webp({ quality: 80 })
				.toBuffer()
				.then(data => {
					file.contents = data;
					file.path = file.path.replace(/\.(png|jpg|jpeg)$/i, '.webp');
					cb(null, file);
				})
				.catch(err => cb(err));

		}))
		.pipe(rev())
		.pipe(dest(config.images.dest, { cwd: projectRoot }))
		.pipe(rev.manifest('rev-manifest.json'))
		.pipe(dest('dist/rev', { cwd: projectRoot }));
}

// ======================
// SVG 
// ======================

function svg() {
	return src(config.svg.src, { cwd: projectRoot })
		.pipe(plumber())
		.pipe(svgSprite(svgConfig))
		.pipe(dest(config.svg.dest, { cwd: projectRoot }))
		.pipe(browserSync.stream());
}
exports.svg = svg;

// ======================
// Автоматическая генерация @font-face
// ======================

function generateFonts(done) {

	const fontsDir = config.fonts.src;
	const scssFile = config.styles.root + '/base/_fonts.scss';

	if (!fs.existsSync(fontsDir)) {
		done();
		return;
	}

	const fontFiles = fs.readdirSync(fontsDir).filter(file => file.endsWith('.woff2'));

	if (fontFiles.length === 0) {
		done();
		return;
	}

	let fontFaceContent = '';

	fontFiles.forEach(file => {

		const fileName = file.replace('.woff2', '');
		const parts = fileName.split('-');

		const fontName = parts[0];
		const weightName = parts[1] || 'Regular';

		let fontWeight = 400;
		let fontStyle = 'normal';

		if (weightName.toLowerCase().includes('thin')) fontWeight = 100;
		else if (weightName.toLowerCase().includes('extralight')) fontWeight = 200;
		else if (weightName.toLowerCase().includes('light')) fontWeight = 300;
		else if (weightName.toLowerCase().includes('regular')) fontWeight = 400;
		else if (weightName.toLowerCase().includes('medium')) fontWeight = 500;
		else if (weightName.toLowerCase().includes('semibold')) fontWeight = 600;
		else if (weightName.toLowerCase().includes('bold')) fontWeight = 700;
		else if (weightName.toLowerCase().includes('extrabold')) fontWeight = 800;
		else if (weightName.toLowerCase().includes('black')) fontWeight = 900;

		if (weightName.toLowerCase().includes('italic')) fontStyle = 'italic';

		fontFaceContent += `
@font-face {
	font-family: "${fontName}";
	src: url("../assets/fonts/${file}") format("woff2");
	font-weight: ${fontWeight};
	font-style: ${fontStyle};
	font-display: swap;
}
`;
	});

	fs.writeFileSync(scssFile, fontFaceContent);

	done();
}
exports.generateFonts = generateFonts;

// ======================
// WATCH
// ======================

function watcher() {
	watch(config.html.watch, { cwd: projectRoot }, html);
	watch(config.styles.src, { cwd: projectRoot }, styles);
	watch(config.js.watch, { cwd: projectRoot }, series(commonJs, libsJs));
	watch(config.images.watch, { cwd: projectRoot }, images);
	watch(config.svg.watch, { cwd: projectRoot }, svg);
	watch(config.fonts.src, { cwd: projectRoot }, generateFonts);
}

// ======================
// BUILD
// ======================

const build = series(
	clean,
	parallel(styles, svg, fonts, generateFonts),
	series(commonJs, libsJs),
	images,   // сначала создаём webp + rev-manifest
	html      // потом переписываем HTML
);

function fonts() {
	return src(config.fonts.src, { cwd: projectRoot })
		.pipe(dest(config.fonts.dest, { cwd: projectRoot }));
}

const dev = series(build, parallel(server, watcher));

exports.build = build;
exports.default = dev;
exports.clean = clean;