Created by 曾思尹, last modified on 五月 13, 2024

IR链接：

  [https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b044](https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b044)    ?    
  #YASHAN-244 支持local UDT创建index by功能

SR链接：

  [https://pingcode.yasdb.com/pjm/items/66115672579a3edb84d68c67](https://pingcode.yasdb.com/pjm/items/66115672579a3edb84d68c67)    ?    
  #YDBRD-19162 支持local UDT创建index by varchar

  [https://pingcode.yasdb.com/pjm/items/6611566f579a3edb84d68c5f](https://pingcode.yasdb.com/pjm/items/6611566f579a3edb84d68c5f)    ?    
  #YDBRD-19161 支持local UDT创建index by integer

  


##   [1. 总述](#1-总述)  

table ... index by 语法声明的类型叫关联数组，是一个key-value对的集合，每个key是一个唯一的索引，通过语法variable_name(index)定位数据。

可以在PLSQL block或package中定义。

该类型实例的特点：

- 是空（存在但没元素）但不是NULL。
- 访问数据时不需要知道位置。
- 不能在DML语句中使用。


###   [1.1 需求来源](#11-需求来源)  

源于国信融选市场需求，在匿名块中创建index-by table作为小型查找表使用，一般和 forall ... in indices of ... dml_statement 搭配使用。

###   [1.2 调研文档](#12-调研文档)  

  [https://conf.yasdb.com/pages/viewpage.action?pageId=133585620](https://conf.yasdb.com/pages/viewpage.action?pageId=133585620)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能1|index-by table类型变量声明|在原有的local UDT语法上新增"index by"；新增index-by table类型构造函数"key=>value"语法|是|是|
|功能2|table index by int|key为int类型的key-value对存储和访问|是|是|
|功能3|table index by string|key为varchar类型的key-value对存储和访问|是|是|
|功能4|index-by table类型变量赋值|variable(key) := value;用key进行二分查找修改对应的value，查找失败时插入新的key-value对，通过二分查找插入使key-value对集合是key有序的|是|是|
|功能5|index-by table类型变量访问|variable(key)用key进行二分查找获取对应的value|是|是|
|功能6|index-by table类型变量使用集合变量操作方法|FIRST、NEXT、LAST、PRIOR、DELETE、EXISTS、COUNT、LIMIT、EXTEND、TRIM方法适配|是|是|
|功能7|bulk collect into支持index-by table类型变量|在已有的bulk collect into支持varray类型变量的基础上新增支持index为int类型的index-by table类型变量，index从1递增|是|是|
|性能|性能场景1||否|否|
|可用性|恢复场景|----|否|否|
|可靠性|故障场景|----|否|否|
|可维可测|DFX功能1|----|否|否|
|安全|安全场景1|----|否|否|
|易用性|----|----|否|否|
|可修改性|----|----|否|否|
|兼容性|----|----|否|否|
|周边配合|权限|----|----|否|
|周边配合|审计|----|----|否|


###   [1.4 数据字典](#14-数据字典)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|关联数组（index-by table）|关联数组是一个key-value对的集合，每个key是一个唯一的索引，通过语法variable_name(index)定位数据|是|业界资料链接     [https://docs.oracle.com/en/database/oracle/oracle-database/19/lnpls/plsql-collections-and-records.html](https://docs.oracle.com/en/database/oracle/oracle-database/19/lnpls/plsql-collections-and-records.html)  |


###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

**列出从SR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**  SR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志 等

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|高级包|高级包子对象描述|----|否|
|系统视图|视图域段描述|----|否|
|动态视图|视图域段描述|----|否|
|配置参数|配置参数作用、生效方式|----|否|
|驱动接口|驱动对外提供接口描述|----|否|
|错误码|错误码、ACTION描述|----|否|
|告警|告警描述|----|否|
|日志|日志触发条件、等级、事件描述|----|否|


##   [3. 规格与约束](#3-规格与约束)  

1. 在声明index-by table类型时，index by的数据类型只能为int/varchar，否则报错“不支持的表索引类型”。在使用variable(index)语法时，index会进行隐式类型转换。
1. 索引不可为null。
1. index by string时，索引按服务端字符集大小写敏感模式排序。
1. 绑定参数、内置函数中的数组函数禁用index-by table。
1. bulk collect into index-by table仅支持index为int类型的index-by table，不支持index为varchar类型的index-by table。


##   [4. 特性](#4-特性)  

###   [4.1 新增语法适配](#41-新增语法适配)  

1. index-by table类型定义语法，支持index by int/varchar。
1. index-by table类型变量无需调用构造函数进行初始化（在声明时隐式调用了构造函数进行初始化）。
1. 支持index-by table类型构造函数"key=>value"语法。


- parse阶段解析函数参数列表时，对"left=>right"语法不再检查left表达式，并把left的原始ExprNode拷贝到EXPR_ARG的左孩子结点，放在verify阶段检查并区分是按名字指定参数值的场景还是使用index-by table构造函数的场景。
- 未使用该语法指定值报错无效参数，varray、nested table类型的构造函数不能使用该语法，否则报错无效参数。


1. variable(index)会对index作隐式类型转换。


###   [4.2 结构体调整](#42-结构体调整)  

index-by table基于原有的varray实现进行扩展。

```
typedef struct StVarrayMembers {
    CodPointer owner;
    AllocMem   allocMem;
    CodPointer variants;  // value array
    CodPointer indexs;    // key-valueId array, value=variants[valueId]
    CodUint16  bifId;
    union {
        CodUint16 flags;
        struct {
            CodUint16 isConstructor     : 1;
            CodUint16 isImplicitDef     : 1;
            CodUint16 isIndexByTable    : 1;  // index-by table
            CodUint16 isIndexString     : 1;  // index by string
            CodUint16 isBulkVar         : 1;
            CodUint16 reserved          : 11;
        };
    };
    CodUint32 deleteCount;  // delete count, count method return (arrayCount-deleteCount)
} VarrayMembers;

// key-valueId array element struct
typedef struct StVarrayIndex {
    Variant   key;
    CodUint32 valueId;
    CodUint16 isDeleted;
    CodUint16 envCharset;
} VarrayIndex;

typedef struct StSoVarrayDesc {
    SoVarDef*  typeDef;
    CodPointer limitExpr;
    CodUint64  udtToid;
    CodUint32  bound;
    union {
        CodUint16 flags;
        struct {
            CodUint16 nullable          : 1;
            CodUint16 isMemberUdt       : 1;
            CodUint16 isIndexByTable    : 1;  // index-by table
            CodUint16 isIndexString     : 1;  // index by string
            CodUint16 reserved          : 12;
        };
    };
    CodUint8   unused[2];
} SoVarrayDesc;

```

![](https://pingcode.yasdb.com/atlas/files/public/67396d3ba1ad9a3311dc8fbb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY3NjAsImV4cCI6MTc4MjMxNzU2MH0.2fsBZto882ISSzX_UT-PFTPVbX6ztkfPbWi26KLC1EM)

赋值时（赋值语句、作为函数out参数），在indexs列表中二分查找key，找到则通过key对应的valueId取得value指针，未找到则在查找失败的位置插入新key，valueId为新增value的位置。二分查找插入保证indexs是key有序的。

访问时在indexs列表中二分查找key，找到则通过key对应的valueId取得value指针，未找到则报错"no data found"（no_data_found异常可捕获）。

varray不使用indexs列表，nested table只使用indexs列表成员index上的isDeleted标志位。

对于nested table和index-by table，通过索引访问已删除的成员报错"no data found"，已删除成员可以通过索引重新赋值（deleteCount--），赋值时同一索引会复用内存，index-by table还会检查查找失败的位置，index.isDelete==true也会复用内存。

###   [4.3 集合变量操作方法适配](#43-集合变量操作方法适配)  

除调整内容外，方法的其余规格保持不变。

给定索引，index-by table先进行二分查找，找到索引在indexs列表中对应的位置再往前或往后查找满足条件的索引。

方法对于索引参数会作隐式类型转换，index by string索引会转换为varchar类型，其他集合类型索引会转换为int类型，不能转换则报错。

|方法|调整内容|
|---|---|
|limit|index-by table返回null|
|count|对nested table和index-by table返回未删除成员的数量（variants.count-deleteCount)|
|first|对nested table和index-by table返回第一个未删除成员的索引。当不存在未删除成员时，方法返回null。|
|last|对nested table和index-by table返回最后一个未删除成员的索引。当不存在未删除成员时，方法返回null。|
|next|对nested table和index-by table返回给定索引的下一个索引。给定索引可以是不存在的索引，方法返回的索引是最接近给定索引的下一个索引。当不存在下一个索引时，方法返回null。|
|prior|对nested table和index-by table返回给定索引的上一个索引。给定索引可以是不存在的索引，方法返回的索引是最接近给定索引的上一个索引。当不存在上一个索引时，方法返回null。|
|exists|对nested table和index-by table给定索引的成员已删除返回false，未删除返回true。（VarrayIndex.isDeleted）|
|extend|对index-by table报错。对nested table新增index。（isDeleted=false）|
|trim|对index-by table报错。对nested table移除末尾index，移除的index.isDelete==true时deleteCount--|
|delete|对于nested table和index-by table，方法可以给定1个或2个参数（索引）。给定1个索引，将对应的index.isDelete设置为true（deleteCount++）。给定2个索引delete(a,b)，取[a,b]索引范围中存在的index.isDelete设置为true（deleteCount++）。索引或索引范围无效则直接返回。|


###   [4.4 bulk collect into支持index-by table类型变量](#44-bulk-collect-into支持index-by-table类型变量)  

在已有的bulk collect into支持varray基础上，index-by table类型变量需要额外添加index，index从1开始递增，仅支持int类型index。

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

1. index-by table类型变量和常量的声明、构造、赋值、访问。
1. index-by table作为函数出入参、返回值。
1. index-by table类型在package中的使用。
1. index-by table类型变量相互赋值。
1. index-by table类型嵌套定义。
1. index by int/varchar，访问时使用不同数据类型的index。
1. key/value null测试和not null约束测试。
1. index-by table使用集合变量操作方法，并检查index是否有序。
1. index-by table结合forall、bulk collect into。


##   [6.资料设计章节](#6资料设计章节)  

需修改PL参考手册中的集合变量、自定义类型章节。

##   [7.未来规划](#7未来规划)  

绑定参数支持index-by table。

## Attachments:

## Comments:

|  [](null)  ,字符集的排序问题,Posted by zengsiyin at 五月 07, 2024 10:22|
|---|
|  [](null)  ,bulk外场使用情况，考虑适配或者禁用,Posted by zengsiyin at 五月 07, 2024 10:50|
|  [](null)  ,index by %rowtype,Posted by zengsiyin at 五月 07, 2024 10:54|
|  [](null)  ,index结构体成员带上字符集信息进二分查找,Posted by zengsiyin at 五月 07, 2024 12:00|
|  [](null)  ,不支持，%rowtype继承的类型不是int/char/varchar类型,Posted by zengsiyin at 五月 07, 2024 12:03|
|  [](null)  ,适配，已补充调研,Posted by zengsiyin at 五月 08, 2024 16:50|
