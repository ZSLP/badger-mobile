rm -rf $TMPDIR/haste*
rm -rf $TMPDIR/metro*
rm -rf *.lock
rm -rf ios/Podfile.lock
rm -rf node_modules
watchman watch-del-all
rm -rf ios/build
rm -rf ios/Pods
rm -rf ios/*.lock
npm cache clean --force
yarn install
cd ios
pod install
cd ..
