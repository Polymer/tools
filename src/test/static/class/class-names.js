/** A simple declaration */
class Declaration { }

/** The variable's name is used. */
const VarDeclaration = class ThisNameIgnored { }

/** The left hand side of the assignment is used. */
Assignment = class ThisNameAlsoIgnored { }

/** Namespaced assignments work too */
Namespace.AlsoAssignment = class ThisNameAlsoIgnored { }

/**
 * Declared namespace works too
 * @memberof Declared
 */
AnotherAssignment = class IgnoreIgnoreIgnore { }

let NotAClass; // this comment should not be attached to a class

class ClassWithNoJsDoc { }
