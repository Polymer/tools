class Foo { method3() { } }
{
  class Foo { method1() { }}
  class One extends Foo { }
}
{
  class Foo { method2() { } }
  class Two extends Foo { }
}
class Three extends Foo { }
