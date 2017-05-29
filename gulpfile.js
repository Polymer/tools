const gulp = require('gulp');

gulp.task('build', () => {
  return gulp.src('test/**/*').pipe(gulp.dest('lib/test'));
});
