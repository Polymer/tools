import { ExportedClass as Super1, ExportedConstClass as Super3 } from './class-names.js';
import Super2 from './class-names.js';
import {ReexportedClass as Super1Again} from './reexported-classes.js';
import { ExportedClass as Super1FromExportAll } from './reexported-all.js';
import * as importedNS from './reexported-all.js'

class CL1 extends Super1 { }

class CL2 extends Super2 { }

class CL3 extends Super3 { }

class CL4 extends Super1Again { }

class CL5 extends Super1FromExportAll { }

class CL6 extends importedNS.ExportedClass { }
