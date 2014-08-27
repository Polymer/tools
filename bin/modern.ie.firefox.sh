#
# @license
# Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
# This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
# The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
# The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
# Code distributed by Google as part of the polymer project is also
# subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
#
runFirefox() {
  VBoxManage guestcontrol "IE10 - Win8" exec --username IEUser --image "C:\\Program Files\\Mozilla Firefox\\firefox.exe" --password 'Passw0rd!' --wait-exit -- "$1"
}

killFirefox() {
  VBoxManage guestcontrol "IE10 - Win8" exec --username IEUser --image "C:\\Windows\\system32\\taskkill.exe" --password 'Passw0rd!' --wait-exit -- /IM firefox.exe /F
}

trap "killFirefox; exit 0" EXIT

url=$1
runFirefox "${url/localhost/10.0.2.2}"