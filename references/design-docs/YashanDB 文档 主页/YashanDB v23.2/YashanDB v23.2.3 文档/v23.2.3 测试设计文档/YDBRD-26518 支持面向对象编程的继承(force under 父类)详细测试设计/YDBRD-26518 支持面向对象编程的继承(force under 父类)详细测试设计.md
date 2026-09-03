Created by 张欣, last modified on 六月 17, 2024

# 1. 概述

*简要说明本功能/需求的背景，本文档的适用范围*

# 2. 需求分析

## 2.1 功能点分析

**1.支持父类型存储子类型的值**  ，支持以后，  **原来plsql中可以使用object父类型的位置，现在都支持使用子类型。**  例如：传参 返回值，赋值。

预期父类型传父类型，子类型传子类型 之前已在UDT转测中验证过，不再重复验证；

预期子类型传父类型，父类型缺少子类型的属性 不支持转换。预期失败报错。

  


**1.1赋值**  ：

var1(值('a','b'),类型supertype(AB)) := var2(值('a1','b1','c1'),类型subtype(ABC));   var1 父类型有属性AB, var2子类型有属性ABC

赋值过程，var1会重新初始化空间，用于存储新值。由于var2的属性更多，新初始化的空间比原来要大。比如C是clob类型，则新空间多出32k。

赋值后，var1的值变为('a1','b1','c1')，只是C属性对外不可访问。类型仍然是父类型supertype(AB)。

赋值方式：default值 初始化，set，select into,fetch into,return into，execute into

1. 赋值后，var1可能继续被使用，  **后续操作**  可能：1).访问父类型原来就存在的属性值，也可以修改； 2) 类型检测 还是父类型； 3）父类型子值继续给其他父类型/子类型(不支持，除非使用treat)变量赋值。
1. 存在多层继承，所以一个父类型A可能有子类型AB,AC,子子类型ABD,ACEF.. 等，这些子类型都可以给父类型赋值或传递。 多次赋值，空间可能改大，改小，不应存在无限膨胀或者内存泄漏。
1. 父类型不是最外层的，而是作为其他类型的属性：如object,record 成员属性；varray/nested table 元素属性等；
1. pkg中的变量（主要是公有变量）类型是父类型，由于用到全局变量区，需要单独测试。
1. 也可以做变量default值或成员default值。


**1.2 传参 返回值**

形参/自定义函数返回值类型是父类型，可以传入或返回子类型。子类型属性数量更多，实参占的空间更大。

1. 形参可以是in，out,in out类型
1. 形参default值
1. 过程/函数中可能用到形参的三类方法，涉及多态场景在下面多态测试部分覆盖。


**1.3 绑定变量**

绑定参数预期是父类型，传入子类型。

覆盖静态SQL,动态SQL各类场景。

  


**语法：create type,create type body **  语法上没有新增,object转测时用例有覆盖。

  


**2.支持多态。**  UDT的构造，静态，成员方法支持多态。

子类型继承父类型的属性和方法，可以在子类型中使用  overriding重写父类型的方法，这样在调用子类型时，用到的方法就是子类型独有的方法。

多态语法：

在需要多态的方法前使用   **OVERRIDING**  关键字，head和body中都需要使用该关键字。多态的限制是子类型中重写方法不能改变该方法的头部，如形参列表个数、类型，返回值类型。

未使用OVERRIDING关键字，子类型中不允许出现和父类型同名的方法。

子类型可以声明单独的，父类型中没有的方法，不受限制；

  


需要验证：

1).单独验证多态的支持和生效情况；

2).父类型处传子类型的场景，比如在函数/过程中使用 并且调用了多态的方法，实际传实参哪个类型 就用哪个类型的方法。

父类型父值，预期用父类型的方法；

父类型子值，预期用父类型的方法；

子类型子值，预期用子类型的方法。

**3.支持treat函数。**

TREAT = TREAT '(' expr AS [schema '.'] type ')' .

treat函数返回值为expr,类型为type。

- 执行treat需要对type有execute type/execute any type的权限。
- expr的类型和type类型需要是用户自定义的object类型
- type需要是expr 类型的父类型或者子类型。如果是父类型，返回expr值 类型是父类型； 如果是子类型，如果符合子类型的expr,则返回expr,类型是子类型；如果不符合子类型的expr，返回null；如果不是父子类型，是不相关的类型，编译报错。
- expr 的类型和type类型一致，则无需转换，返回


  


支持部署形态：单机，集群

## 2.2 应用场景

**1.支持父类型存储子类型的值**

|src\dst|父类型|子类型|
|---|---|---|
|父类型子值|**√ 重点验证**|**报错。类型错误**|
|父类型父值|√|报错。类型错误|
|子类型|**√ 重点验证**|√|


赋值：default值 初始化，set，select into,fetch into,return into,execute into

传参 返回值

绑定变量

  


## 2.3 规格约束

- yahsan当前不支持父类型（NOT FINAL）做表列，所以暂不涉及表中类型是父类型，insert值是子类型的场景。
- treat函数不支持as json和as REF用法。
- 不支持的两种语法：语法1 ：使用TREAT内置函数的返回值作为实例，访问方法。如   TREAT(VALUE(p) AS obj_type_25618_Employee).salary
- 语法2：使用type名方法member方法，显示给self参数。


       (SELF AS type15_basetype).f2; Oracle还有个这样的用法

```
create TYPE type15_basetype AS OBJECT 
( 
 x1 NUMBER, 
 x NUMBER, 
 MEMBER PROCEDURE f0 , 
 MEMBER PROCEDURE f1 ,
 MEMBER PROCEDURE f2 ,
 MEMBER PROCEDURE f3) NOT FINAL;
 /

create TYPE BODY type15_basetype AS 
 MEMBER PROCEDURE f0 
 IS 
 BEGIN 
 x := 0; 
 END; 
 MEMBER PROCEDURE f1 
 IS 
 BEGIN 
 x := 1; 
 END; 
MEMBER PROCEDURE f2
 IS
 BEGIN
 x := 2;
 END;
 MEMBER PROCEDURE f3
 IS
 BEGIN
 x := 3;
 END;
END;
/

create TYPE type15_subtype UNDER type15_basetype ( 
 y NUMBER , 
 OVERRIDING MEMBER PROCEDURE f2 
);
/

create TYPE BODY type15_subtype AS 
 OVERRIDING MEMBER PROCEDURE f2 
 IS 
 BEGIN 
 (SELF AS type15_basetype).f2; 
 x1 := 1; 
 END; 
END;
/
```

  


  


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

**1.支持父类型存储子类型的值**

|  
  方式||变量类型    
    
|||子类型继承层数|子类型新增属性的类型覆盖|赋值后，对父类型子值的操作|异常情况|  
|
|---|---|---|---|---|---|---|---|---|---|
|**赋值**|  
|普通object变量|pkg变量|object,record 成员属性；varray/nested table 元素属性|  
|  
|  
|  
|  
|
|  
|变量default值|  
|  
|  
|二层：A，AB,三层：A，AB，ABC/ABD,多层：5层 100+层|标量类型：都覆盖，定长，变长，lob,json，xml,  
|1).访问、修改父类型原来就存在的属性值；,多出的子类型属性不支持访问|父类型force修改属性，定长-变长，,子类型，子子类型重编译后属性更新|并发场景|
|  
|set|  
|全局，,可串行化|  
|  
|object|2) 类型检测|  
|  
|
|  
|select into|  
|  
|  
|  
|record|   3）父类型子值继续给其他父类型变量赋值。,父类型子值直接给子类型变量赋值 -不支持。treat(父类型子值 as 子类型)|  
|  
|
|  
|fetch into|  
|  
|  
|  
|varray/nstb |4）父类型子值作为实参或返回值|  
|  
|
|  
|return into|不支持return udt列|  
|  
|  
|子类型新增属性个数较多，占的空间大|5）父类型子值作为绑定变量|  
|  
|
|  
|execute into|  
|  
|  
|  
|多次赋值，子类型新增属性所占空间较大,多次修改，A:=ABC,A:=ABD,A:=AB,A:=ABCD等|  
|  
|  
|
|传参,返回值,（形参父类型，实参传子类型）|  
|  
|  
|  
|  
|  
|形参在过程体中可能的操作|  
|  
|
|  
|形参default值|  
|  
|  
|  
|  
|给其他变量赋值|  
|  
|
|  
|游标default值|  
|  
|  
|  
|  
|被赋值，修改父类型原有属性,访问子类型的属性-不支持报错|  
|  
|
|  
|过程/函数 实参|in，out, in out类型|  
|  
|  
|  
|过程/函数/游标嵌套 形参多层传递,嵌套子过程体 ,pkg子过程|  
|  
|
|  
|自定义函数返回值|  
|  
|  
|  
|  
|函数返回值作为expr或者绑定变量|  
|  
|
|  
|object方法的形参：,构造方法-入参，返回值,静态方法,成员方法|  
|  
|  
|  
|  
|  
|  
|  
|
|绑定变量|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|  
|动态SQL：赋值,过程/函数参数,  
|  
|  
|  
|  
|  
|  
|  
|  
|


  


**2.支持多态**

**语法测试**

|有效等价类|无效等价类|
|---|---|
|1. 子类型重写父类型中的一个或多个方法；
1. 有多个子类型，每个子类型中重写各自的方法；
1. 多层继承的子类型，A-AB-ABC AB中重写，ABC中继承AB中重写的方法
,  
|1. 未使用OVERRIDING关键字，子类型中出现和父类型同名的方法
1. 子类型仅head或仅body使用了OVERRIDING关键字
1. 子类型独有的 方法使用overriding关键字
1. 重写改变了形参个数、类型、返回值类型，和父类型不匹配
1. OVERRIDING关键字位置错误，拼写错误
|


  


**方法类型**  ：

- 构造方法 - 不支持
- 静态方法 - 不支持
- 成员方法 -支持（包含MAP,ORDER - 不支持）


说明：范围有裁剪，未做重写异常情况的限制

**方法B调用了方法A**  : 

|B调用  \ 被调用A|A多态|  
|
|---|---|---|
|B是父子类型中都有的方法，非多态|  
|  
|
|B是父子类型中都有的方法，多态|  
|  
|
|B是外部过程/函数|父类型父值，预期用父类型的方法；,父类型子值，预期用父类型的方法；,子类型子值，预期用子类型的方法。|  
|


其他：

create or replace   **force **  强制修改父类型的属性，方法，多态方法。

  


**3.1.1 treat函数，等价类划分**

|**expr**||**type**||  
|
|:---:|---|:---:|---|---|
|有效等价类|无效等价类|有效等价类|无效等价类|预期|
|  
|非object 类型：,常量，标量，record，varray,nsted table(local,pkg,全局),特殊值：null，为空,  
|  
|非object 类型：,标量（json），record，varray,nsted table(local,pkg,全局),as json（暂不支持）,as REF（暂不支持）,缺失,不存在的type,无效的schema,权限：对当前调用user没有execute权限的type,%type|报错|
|object类型type1    
    
    
|  
|type1的父类型supertype，父父类型|  
|返回expr,类型是supertype|
||  
|type1的子类型subtype，子子类型,expr值格式和子类型匹配|  
|返回expr,类型是subtype|
||  
|  
|expr值格式和子类型不匹配（如  treat(data_typ1(9) as sub_data_typ3)   ）|返回null|
||  
|type1|  
|返回expr,类型是type1|
||  
|  
|特殊值：null,未初始化的变量|  
|
||  
|  
|非type1的相关类型（不是类型本身，父类型，子类型）,AB,AC|编译报错|
||  
|其他：同义词|  
|  
|
||  
|expr类型：,变量，pkg变量,构造函数表达式（常量），静态方法，成员方法返回值,自定义函数返回值,绑定变量,  
|  
|  
|


**3.1.2 treat使用场景：**

|一级|二级|三级|
|---|---|---|
|sql场景,  
|select |投影列，各类filter条件,分组group by,聚合|
|  
|insert|  
|
|  
|update|set value,,filter|
|  
|delete|filter|
|  
|merge|  
|
|  
|table列default值|  
|
|plsql使用场景|游标    
    
|投影列，filter|
|  
||游标形参default值,游标实参|
|  
||fetch into|
|  
||动态游标绑定参数传入|
|  
|作为实参传入|in类型形参支持,out,in out不支持|
|  
|形参default值|  
|
|  
|内置函数返回值|  
|
|  
|变量的default值|  
|
|  
|select into|投影列，filter|
|  
|DML|insert|
|  
||update|
|  
||delete|
|  
||merge|
|  
|set value赋值,  
|a := treat(),a.attr1 := treat(),a(1) := treat()|
|  
|绑定变量|expr传绑定变量|
|  
|  
|treat()函数表达式作为绑定变量传入|
|  
|UDT方法中使用|  
|
|  
|dbms_sql|parse,execute 前改变expr (变量),type  (force)|
|函数嵌套|treat()函数自嵌套|多层嵌套 多次转换,treat(ABC as AB), AB as ABD ,AB as ABC, ABC as ABD|


3.1.3权限：

user1使用treat(expr as type1) ,user1需要有type1的execute type/execute any type权限。

user1 调用user2.procedure, user2.procedure中用到treat(expr as type1)，user2需要有type1的execute type/execute any type权限。

  


## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|系统级DFX分类|是否涉及|
|---|---|
|CT|是|
|KT|/|
|长稳|是|
|一致性|/|
|三方测试工具    
  (sqltest，sqlancer)|/|
|安全|/|
|DFR|/|
|HA|/|
|压力|/|
|性能|/|
|可维护性|/|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDc4OTcwYzJhZjRmNTIwZmU4IiwicmVmX2lkIjoiNjczOTZkMDc3MjgyMDZlZmI5MmYxYTM1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1Mzk1LCJleHAiOjE3ODIzOTE3OTV9.wAM7hXmkbMnhYhIjRhvlE0i5JeJAxu3_wDTd6JTYGtA)

# 8.后续关注

1.not final的父类型不能做表列，所以表中是父类型，数值插入子类型的场景目前不可测；

2.表达式的特殊用法。TREAT(VALUE(p) AS Employee).salary 等

  


  


## Attachments:

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDc4OTcwYzJhZjRmNTIwZmU4IiwicmVmX2lkIjoiNjczOTZkMDc3MjgyMDZlZmI5MmYxYTM1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1Mzk1LCJleHAiOjE3ODIzOTE3OTV9.wAM7hXmkbMnhYhIjRhvlE0i5JeJAxu3_wDTd6JTYGtA)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDdhMWFkOWEzMzExZGM4ZTU4IiwicmVmX2lkIjoiNjczOTZkMDc3MjgyMDZlZmI5MmYxYTM1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1Mzk1LCJleHAiOjE3ODIzOTE3OTV9.z7_Ho1jXouV1BAkZawERZ2G2xtz5yXI2_6KC4Gjl700)

 (application/msword)    
