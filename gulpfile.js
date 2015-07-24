'use strict';

var gulp = require('gulp');
var $ = require('gulp-load-plugins')();
var Q = require('q');


function promisifyStream(stream) {
	return new Q.Promise(function(resolve, reject) {
		stream
		.on('finish', resolve)
		.on('error', reject);
	});
}

function coveralls() {
	return promisifyStream(
		gulp.src(['coverage/lcov.info'])
		.pipe($.coveralls())
	);
}

function testAndCoverage(lcovOnly) {
	var reportOptions;

	if (lcovOnly) {
		reportOptions = {
			reporters: ['lcov', 'text', 'text-summary']
		};
	}

	return promisifyStream(
		gulp.src(['test/*.js'])
		.pipe($.mocha())
		.pipe($.istanbul.writeReports())
		.pipe($.istanbul.enforceThresholds({
			thresholds: {
				global: 90
			}
		}))
	);
}

function validateFiles(files, simple, lcovOnly) {

	var stream = gulp.src(files)
	.pipe($.jshint())
	.pipe($.jshint.reporter(require('jshint-stylish')))
	.pipe($.jshint.reporter('fail'))
	.pipe($.jscs());
	if (!simple) {
		stream = stream.pipe($.filter(['*', '!test/*']))
		.pipe($.istanbul())
		.pipe($.istanbul.hookRequire());
	}

	var retPromise = promisifyStream(stream);
	if (!simple) {
		return retPromise.then(function() {
			return testAndCoverage(lcovOnly);
		});
	}
	return retPromise;
}

var files = [
	'**/*.js',
	'!node_modules/**/*',
	'!docs/**/*',
	'!coverage/**/'
];

gulp.task('default', function() {
	if (process.env.TRAVIS) {
		return validateFiles(files, false, true);
	}
	return validateFiles(files);
});

gulp.task('simple', function() {
	return validateFiles(files, true);
});

var LessPluginCleanCSS = require('less-plugin-clean-css');
var LessPluginAutoPrefix = require('less-plugin-autoprefix');

var distPath = './dist';

var paths = {
	style: {
		bundle: 'all.css',
		less: {
			input: ['./app/styles/less/**/*.less'],
			output: distPath + '/styles/css'
		},
		sass: {
			input: ['./app/styles/sass/**/*.scss'],
			output: distPath + '/styles/css'
		}
	},
	scripts: {
		input: ['./app/scripts/**/*.js'],
		output: distPath + '/scripts'
	},
	images: {
		input: ['./app/images/**'],
		output: distPath + '/images'
	}
};

gulp.task('clean', function() {
	return gulp.src(distPath, {
		read: false
	})
	.pipe($.clean({
		force: true
	}))
	.pipe(gulp.dest(''));
});

gulp.task('scripts', function() {
	gulp.src(paths.scripts.input)
	.pipe($.uglify(undefined, {
		outSourceMap: true
	}))
	.pipe(gulp.dest(paths.scripts.output));
});

gulp.task('sass', function() {
	gulp.src(paths.style.sass.input)
	.pipe($.sourcemaps.init())
	.pipe($.sass())
	.pipe($.sourcemaps.write('./maps'))
	.pipe(gulp.dest(paths.style.sass.output));
});

gulp.task('less', function() {
	gulp.src(paths.style.less.input)
	.pipe($.sourcemaps.init())
	.pipe($.less({
		plugins: [
			new LessPluginCleanCSS({
				advanced: true
			}),
			new LessPluginAutoPrefix({
				browsers: ['last 2 versions']
			})
		]
	}))
	.pipe($.sourcemaps.write('./maps'))
	.pipe(gulp.dest(paths.style.less.output));
});

gulp.task('images', function() {
	return gulp.src(paths.images.input)
	.pipe($.imagemin())
	.pipe(gulp.dest(paths.images.output));
});

gulp.task('watch', function() {
	gulp.watch(paths.scripts.input, ['scripts']);
	gulp.watch(paths.style.less.input, ['less']);
	gulp.watch(paths.style.sass.input, ['sass']);
});

gulp.task('dev', ['dist', 'watch'], function() {
	gulp.src('./package.json')
	.pipe($.open('', {
		url: 'http://localhost:3000',
		app: 'chromium-browser'
	}));
	
});

var runSequence = require('run-sequence');

gulp.task('dist', function(callback) {
	runSequence('clean', ['scripts', 'less', 'sass', 'images'], callback);
});

gulp.task('coveralls', coveralls);

gulp.task('git-pre-commit', ['default']);