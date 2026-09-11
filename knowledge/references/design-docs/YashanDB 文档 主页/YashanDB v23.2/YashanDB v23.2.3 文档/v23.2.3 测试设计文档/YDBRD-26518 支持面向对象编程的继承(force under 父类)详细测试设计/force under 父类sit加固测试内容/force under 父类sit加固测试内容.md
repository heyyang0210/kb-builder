Created by 张欣, last modified on 六月 17, 2024

1.case when+treat

case when判断不同的子类型，并访问子类型独有的属性。

  


2.外部过程调用重写的方法

子类型重写父类型的方法，外部函数形参是父类型，分别传入父类型、子类型的实参

create or replace force 强制修改父类型的方法，修改后再调用重写的方法。

3.  表列数据是子类型，不支持使用父类型的值

  


4.并发场景

多层继承100+，普通匿名块，pkg中变量使用这些类型，并发调用

并发调用+alter type重编译

并发调用+alter type重编译+修改+drop type

------

父类型force修改属性，定长-变长 +并发调用

父类型force修改方法，+并发调用