Created by 党文琪, last modified on 十月 21, 2024

# 1. 概述

此文档为pipelined函数功能详细测试设计。

# 2. 需求分析

## 2.1 功能点分析

- 功能概述：


pipelined函数又称为管道函数，普通的函数需要在处理完所有行之后再将结果一次性返回，而pipelined函数，  在处理行后立即将行返回到调用源，并继续处理该行。 响应时间缩短，因为在查询中返回单个结果行之前，不必将整个集合组合并返回到服务器。若要将执行结果返回给调用者，需要用到pipe row

- 开发设计文档：    [概要设计-Pipelined Table Function - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=147774586)  
- SR:    [https://pingcode.yasdb.com/pjm/items/6610feb5579a3edb84d494cb](https://pingcode.yasdb.com/pjm/items/6610feb5579a3edb84d494cb)    ?    
  #YDBRD-11623 PIPELINED UDF元数据管理     [https://pingcode.yasdb.com/pjm/items/6610feb8579a3edb84d494d3](https://pingcode.yasdb.com/pjm/items/6610feb8579a3edb84d494d3)    ?    
  #YDBRD-11624 PIPE ROW语句实现


|  
|关注点|  
|
|---|---|---|
|1|创建位置|package function 友商支持|
|2|  
|standalone function 友商支持|
|3|  
|obj的function中 友商支持,本次转测不支持|
|4|  
|调研中发现，可以创建子过程体带关键字，但受到调用限制，不调用不报错|
|5|入参|支持标量类型，UDT类型，本次转测不支持游标变量类型|
|6|  
|只支持in类型|
|7|  
|支持设置默认值|
|8|返回值|必须是一个数组类型，支持TABLE/VARRAY|
|9|  
|必须是全局type或package中定义的type|
|10|  
|只支持supported collection，不支持关联数组|
|11|  
|友商中规定，集合的元素类型必须是SQL数据类型，yashan在标量类型上无区分，udt类型嵌套（pkg type+pkg type这里可以关注下）|
|12|  
|关注重点：返回值为数组+record类型，这里的转换规则参照    [https://conf.yasdb.com/x/5JEeCQ](https://conf.yasdb.com/x/5JEeCQ)  |
|13|执行内容|pipe row常用但可选|
|14|  
|常规过程体支持的内容|
|15|  
|子过程体|
|16|return|return后不加返回值|
|17|  
|可以无return关键字|
|18|调用|  `SELECT`         `* `      `FROM`         `TABLE`      `(function_name(...))`  |
|19|  
|  `SELECT`         `* `      `FROM`         `function_name()`  |
|20|  
|  `SELECT`         `function_name()from dual 本次转测不支持`  |
|21|  
|table functions are not allowed in PL/SQL scope|
|22|  
|SELECT 语句用于游标，动态执行，select into赋值，子查询|
|23|涉及视图|dba_procedures，  PIPELINED 字段|
|24|  
|sys.procedure$，  OPTIONS|
|25|  
|dba_objects|
|26|  
|desc dba_source|
|27|审计|  
|
|28|导入导出|创建pipelined函数，导入或导出后，function可以正常调用|
|29|内存|使用vm_block|


参考：

|udt类型测试梳理表|全局|local|pkg|
|---|---|---|---|
|1|obj|record|record|
|2|varray|varray|varray|
|3|nstb|nstb|nstb|


  


## 2.3 规格约束

1、  管道函数只有入参，不能有出参、出入参；RETURN语句中不带返回值

2、  管道函数内部不能有主事务，最多有自治事务；主事务情况下不允许出现DML/DDL；

3、  管道函数不能被过程体调用，不能递归自己，不能调用其他过程体；即一个pipelined函数是一个完整的可执行单元；

4、  管道函数只能返回集合类型，PIPE ROW放入的行数据必须是标量或者OBJECT

5、  不支持游标类型参数；

6、  不支持游标表达式；

7、管道函数不支持输出DMBS_OUTPUT 消息；

8、不支持管道函数整体作为投影列使用；

9、不支持PARALLEL_ENABLE关键字；

10、不支持DETERMINISTIC关键字；

11、不支持OBJECT方法定义管道函数；

12、管道函数返回的集合元素类型不支持record类型

# 3. 详细测试设计

## 3.1 测试设计方法

本测试设计基于功能分析，覆盖function的定义，使用等价类划分法，正交法测试

分为定义场景，执行场景，被调用场景，关联功能展开测试

## 3.2 详细测试设计

1、语法测试

|  
|  
|  
|  
|  
|
|---|---|---|---|---|
|1|pipelined关键字|支持|在package.functtion|  
|
|2|  
|  
|普通function|  
|
|3|  
|  
|用于object的function中|本次转测不支持|
|4|  
|不支持|用于其他过程体对象|procedure|
|5|  
|  
|用于package中私有的function|  
|
|6|  
|  
|用于子过程体|  
|
|7|  
|  
|多态表函数|暂不支持|
|8|  
|  
|外置UDF|  
|
|9|  
|容错测试|关键字缺失|  
|
|10|  
|  
|关键字拼写错误|  
|


2、功能测试

|  
|入参测试|  
|  
|  
|  
|
|---|---|---|---|---|---|
|1|无入参|  
|  
|  
|  
|
|2|有入参|入参方向|in out|不支持|  
|
|3|  
|  
|out|不支持|  
|
|4|  
|  
|in|支持|  
|
|5|  
|入参类型|普通标量类型|数字类型|  
|
|6|  
|  
|  
|字符串类型|n类型|
|7|  
|  
|  
|  
|非n类型|
|8|  
|  
|  
|lob类型|clob|
|9|  
|  
|  
|  
|blob|
|10|  
|  
|udt类型|有toid的外部定义类型|  
|
|11|  
|  
|  
|无toid的pkg定义类型|  
|
|12|  
|  
|  
|无toid的本地定义类型|  
|
|13|  
|  
|cursor|强类型游标变量|不支持，要有拦截用例|
|14|  
|  
|  
|弱类型游标变量|不支持，要有拦截用例|
|15|  
|  
|  
|sys_refcursor|不支持，要有拦截用例|
|16|  
|默认值|有默认值|调用时不用默认值|  
|
|17|  
|  
|  
|调用时用默认值|  
|
|18|  
|  
|不设置默认值|  
|  
|


|  
|返回值测试|  
|  
|  
|  
|
|---|---|---|---|---|---|
|1|类型来源|继承|继承pkg中变量|同一个pkg头部|  
|
|2|  
|  
|  
|不同pkg的头部|  
|
|3|  
|  
|继承表列类型|  
|  
|
|4|  
|显式定义|过程体外定义|  
|  
|
|5|  
|  
|pkg头部中定义|  
|  
|
|6|  
|  
|pkgbody定义|  
|  
|
|7|  
|  
|过程体内定义|pipelined不支持子过程体，拦截|  
|
|8|返回值类型|非数组|标量|不支持|  
|
|9|  
|  
|object|不支持|  
|
|10|  
|  
|record|不支持|  
|
|11|  
|  
|游标变量|不支持|  
|
|12|  
|数组|关联数组|预计拦截|  
|
|13|  
|  
|非关联数组|table|内层为标量类型（所有类型全覆盖遍历）,table+数值型INT/INTEGER/pls_integer    
  table+数值型SMALLINT    
  table+数值型FLOAT    
  table+数值型TINYINT    
  table+数值型BIGINT    
  table+数值型NUMBER    
  table+数值型DOUBLE    
  table+数值型BIT    
  varray+CHAR    
  varray+VARCHAR（覆盖返回值超出精度/未超出精度）    
  varray+NCHAR    
  pkg.varray+NVARCHAR    
  pkg.varray+Boolean    
  varray+CLOB    
  varray+BLOB    
  table+rowid    
  table+urowid    
  table+raw    
  table+json    
  varray+ST_GEOMETRY    
  varray+XMLTYPE    
  varray+BOX2D|
|14|  
|  
|  
|  
|两层嵌套，参考udt类型测试梳理表覆盖（组合类型全覆盖）,pkg udt+pkg类型,pkg udt+全局类型,全局udt+全局udt|
|15|  
|  
|  
|  
|三层嵌套，参考udt类型测试梳理表覆盖（交叉覆盖）,pkg udt+pkg record+pkg udt,pkg udt+pkg record+全局 udt,全局udt+全局udt+全局类型|
|16|  
|  
|  
|varray|内层为标量类型|
|17|  
|  
|  
|  
|两层嵌套，参考udt类型测试梳理表覆盖|
|18|  
|  
|  
|  
|三层嵌套，参考udt类型测试梳理表覆盖|
|19|返回值类型限制,此处标准为，支持的是SQL引擎可以解析的类型|过程体内table/varray+table/varray|  
|预计拦截|  
|
|20|  
|- collections of PL/SQL types: rowid, mlslabel, long,
- long raw, boolean, binary_integer, pls_integer, string and urowid
|  
|  
|  
|
|21|  
|table+record,record的元素为不支持的类型|不支持的标量|  
|  
|
|22|  
|  
|不支持的udt类型|  
|  
|
|23|  
|table+record，再嵌套一层record|报错|  
|  
|
|24|return关键字|无return关键字|  
|  
|  
|
|25|  
|有关键字，但关键字还返回了其他值|  
|  
|  
|


|  
|执行内容|  
|  
|
|---|---|---|---|
|1|赋值|赋值方式|等值赋值|
|2|  
|  
|select into|
|3|  
|  
|returning into|
|4|  
|  
|fetch|
|5|静态SQL|DML语句|insert|
|6|DML但有关联触发器|  
|update|
|7|  
|  
|delete|
|8|  
|  
|merge|
|9|  
|自治事务|  
|
|10|  
|commit/rollback|  
|
|11|动态SQL|DML语句|insert|
|12|DML但有关联触发器|  
|update|
|13|  
|  
|delete|
|14|  
|  
|merge|
|15|  
|  
|select|
|16|  
|自治事务|  
|
|17|  
|commit/rollback|  
|
|18|  
|ddl语句|有自治事务时支持|
|19|  
|  
|无自治事务时拦截|
|20|FORALL/BULK|  
|  
|
|21|调用高级包|DBMS_OUTPUT.PUT_LINE|对比打印输出的阶段与友商是否有差异|
|22|异常处理|调用层有异常处理，定义层无|  
|
|23|  
|调用层无异常处理，定义层有|  
|
|24|  
|调用层和定义层都有异常处理|  
|
|25|  
|调用pipelined table function，不再需要该函数返回的行，PIPEROW会 raises NO_DATA_NEEDED（资料测试时也要关注）|用rownum限制行数|
|26|  
|  
|limit限制行数|
|27|子过程体|调用子过程清洗数据后返回|  
|
|28|  
|在子过程体中加pip row|  
|
|29|调用其他存储过程|  
|  
|
|30|pipelined函数递归|  
|  
|
|31|PIPE ROW|参考PIPE ROW测试设计|  
|
|32|循环中改变返回数组的赋值|流程控制的循环|  
|
|33|  
|游标的for循环|  
|
|34|record值赋给其他变量（标量or object）|  
|  
|
|35|自治事务定义的范围|子过程体中有自治事务标记时（外有内无，外无内有，都有，都无）|子过程体中有dml语句|
|36|创建触发器时，表的位置放pipelined（预计拦截报错）|  
|  
|


|  
|PIPE ROW|  
|  
|  
|  
|
|---|---|---|---|---|---|
|1|语法测试|拼写错误|  
|  
|  
|
|2|  
|缺少关键字|  
|  
|  
|
|3|  
|有多个入参，并用，分割|报错拦截|  
|  
|
|4|  
|null|  
|  
|  
|
|5|功能测试|在pipelined函数中使用|入参类型|标量|  
|
|6|  
|  
|  
|变量|直接传变量|
|7|  
|  
|  
|  
|传绑定参数|
|8|  
|  
|  
|  
|变量传入函数，函数外面再套pipe row|
|9|  
|  
|  
|函数返回值（  关注下调用其他函数是否成功，如果支持，自定义函数中是否可以有dml，是否可以pipelined，dml语句上加了触发器  ）|自定义函数返回值|
|10|  
|  
|  
|  
|子过程体返回值|
|11|  
|  
|pipe row返回类型|与定义时 table子类型匹配|  
|
|12|  
|  
|  
|与定义时table子类型不匹配（区分下record和普通标量，record类型覆盖%rowtype，%type，显式定义三种）|可隐式转换|
|13|  
|  
|  
|  
|不可隐式转换|
|14|  
|自治事务|piperow之前没有COMMIT /rollback|有dml语句|  
|
|15|  
|  
|  
|无dml语句|  
|
|16|  
|  
|piperow之前有COMMIT /rollback|有dml语句|  
|
|17|  
|  
|  
|无dml语句|  
|
|18|  
|在非pipelined函数中使用|  
|  
|  
|


  


3、应用场景

|  
|过程体内应用|是否支持|测试点|  
|
|---|---|---|---|---|
|1|function用于赋值|预计拦截|等值赋值|  
|
|2|  
|预计拦截|select into|  
|
|3|用于静态SQL|预计拦截|DML|  
|
|4|做自定义函数返回值|  
|  
|  
|
|5|类型继承|预计拦截|  
|  
|
|6|条件判断|预计拦截|  
|  
|
|7|做入参|  
|高级包入参|  
|
|8|  
|  
|函数入参|  
|
|9|  
|  
|过程体入参|  
|
|10|  
|  
|子过程体入参|  
|
|11|做默认值|  
|游标默认值|  
|
|12|  
|  
|子过程体默认值|  
|
|13|  
|  
|record默认值|  
|
|14|做index|  
|  
|  
|
|15|做数组下标|  
|普通数组|  
|
|16|  
|  
|关联数组|  
|
|17|动态执行|  
| using 做绑定参数|  
|
|18|  
|  
| into 接收值|  
|
|19|  
|动态执行赋值|  
|  
|
|20|在过程体中使用，过程体内变量传入，将select语句用在游标中|支持|入参类型|游标变量，本次暂不支持|
|21|  
|  
|标量|  
|
|22|  
|游标类型|游标变量|  
|
|23|  
|  
|显式游标|  
|
|24|  
|  
|隐式游标|  
|
|25|  
|实现方式|过程体动态执行匿名块|  
|
|26|  
|  
|过程体内的匿名块|  
|
|27|  
|  
|过程体内的子过程|  
|


  


|  
|查询设计|  
|  
|  
|
|---|---|---|---|---|
|1|select|做投影列|本次拦截|  
|
|2|  
|做table|table(function)|支持|
|3|  
|  
|function|支持|
|4|from|单表|  
|  
|
|5|  
|多表|any|  
|
|6|  
|  
|all|  
|
|7|  
|  
|some|  
|
|8|  
|  
|嵌套子查询|  
|
|9|  
|  
|having|  
|
|10|  
|CTE|  
|  
|
|11|filter|filter左值|rownum|  
|
|12|  
|  
|投影列|  
|
|13|  
|filter条件|>, <, =, <>, >=, <=,in,between and,exists,like|  
|
|14|  
|  
|and, or|  
|
|15|union|  
|  
|  
|
|16|group by|  
|  
|  
|
|17|order by|  
|  
|  
|
|18|limit|limit|  
|  
|
|19|  
|limit...offset|  
|  
|
|20|执行计划看护|  
|  
|  
|
|21|关联查询的对象为列表|  
|  
|  
|


4、集群场景设计

|  
|  
|  
|instance1|instance2|instance3|
|---|---|---|---|---|---|
|1|基本功能|pkg|创建pkg头部，包括pkg类型定义和f函数声明|创建package body，定义pipelined函数|select调用pipeline函数|
|2|  
|function|创建全局类型|创建pipelined函数|select调用pipelined函数|
|3|依赖关系|类型依赖|1. 创建pkg头部
1. 调用pipelined
|1. 创建全局pipelined函数
|1. 执行select调用
1. 删除pkg头部
|
|4|  
|  
|1. 创建全局type
|1. 创建pkg.func
1. 删除后再调用pipelined函数
|1. 执行select调用
1. 删除全局type
|
|5|  
|  
|1. 创建全局type1
1. 删除type1
|1. 创建全局type2
1. 调用函数
1. 删除后再调用函数
|1. 创建pipelined返回全局type2
1. 调用函数
|
|6|  
|  
|1. 创建全局type1
1. 调用function
1. 再次调用重建后的function
|1. 创建pkg.type2，嵌套全局type1
1. 重写pkg定义，删除pkg.type2
1. 重新创建function
|1. 创建pkg body，function返回值为pkg.type2
1. 调用function
1. 删除后再调用function
|
|7|  
|function依赖|1. 创建pkg包含pipelined函数
1. 删除后再调用pipelined函数
|1. 调用pipelined函数
|1. 删除pipelined函数
|
|8|  
|  
|1. 创建全局type1
1. 删除函数
|1. 创建全局type2
1. 调用函数
1. 删除后再调用函数
|1. 创建pipelined返回全局type2
1. 调用函数
|
|9|  
|  
|1. 创建pkg.type1
1. 调用function
1. 再次调用重建后的function
|1. 创建pkg.type2，嵌套type1
1. 删除function
1. 重新创建function
|1. 创建pkg body，function返回值为pkg.type2
1. 调用function
1. 删除后再调用function
|
|10|其余集群测试点，由并发测试关注|  
|  
|  
|  
|


5、并发测试

1. 创建依赖对象
1. 创建pkg pipelined函数，包含pipe row，dml，commit/rollback等操作
1. 创建function pipelined函数，
1. 调用函数，select调用和绑定参数调用
1. 修改函数
1. alter function/alter package
1. ddl依赖对象
1. 删除依赖对象
1. 删除函数


单机并发组设计：

1. 创建依赖对象，创建pkg.func，全局func，并发调用函数
1. 创建依赖对象，创建func，并发修改，alter，调用
1. 创建依赖对象，创建func，并发truncate依赖对象，删除依赖type，调用
1. 全量并发，创建依赖对象，创建func，并发修改，alter，删除，调用


集群并发组设计：

1. 实例1创建依赖对象，实例2创建pipelined函数，实例3调用函数
1. 实例1创建依赖对象，实例2创建pipelined函数，实例3调用函数，实例1上并发alter，实例3上并发修改
1. 实例1创建依赖对象，实例2创建pipelined函数，实例3调用函数，实例1上ddl依赖对象，实例3上并删除type
1. 全量并发，实例1创建依赖对象，实例2创建pipelined函数，实例3调用函数，实例1上ddl依赖对象，实例3上并删除type，实例2上ddl依赖对象，实例3上并删除type，实例2上删除函数，实例1上并发修改function


6、性能测试

1. select返回1w行（  具体的数据量在测试时调整，关注下并发的数据量  ），检查select执行的速度，是否有卡顿，泄露，异常
1. 以外场用的split函数为例，处理长字符串（长lob），检查返回数据时的性能


先对比普通函数，执行相同操作时的性能，count(*)不影响性能优化体现

7、导入导出

|  
|  
|测试场景|  
|
|---|---|---|---|
|1|全库导出|创建pipelined函数，包括全局FUNCTION,调用；检查dba_procedures视图,导出,导入，检查视图，调用|  
|
|2|按user导出|  
|  
|
|3|全库导出|创建PKG.PIPELINED函数，调用，检查dba_procedures视图置位是否成功,导出,导入，检查视图，调用|  
|
|4|按user导出|  
|  
|
|5|按照table导出：容错测试|exp sales/sales FILE=export.table.export TABLES=table(pipe.func),exp sales/sales FILE=export.table.export TABLES=pipe.func|  
|


8、审计

审计可以加到已有用例中，执行成功/失败都有审计记录

|  
|审计内容|用例设计|
|---|---|---|
|1|权限审计：,CREATE AUDIT POLICY up1 PRIVILEGES SELECT ANY TABLE; read any table|创建审计策略后，建pipelined function,select *from table（func),,select * from func,检查是否触发审计|
|2|  
|创建审计策略后，建pipelined function,select *from table（pkg.func),,select * from pkg.func,检查是否触发审计|
|3|权限审计：,CREATE AUDIT POLICY up1 PRIVILEGES CREATE PROCEDURE,,CREATE ANY PROCEDURE,,ALTER ANY PROCEDURE,,DROP ANY PROCEDURE,,EXECUTE ANY PROCEDURE;|增删改查，调用pipelined function时，是否有审计记录|
|4|行为审计：,CREATE FUNCTION，ALTER FUNCTION，    
  DROP FUNCTION|创建pipelined function，修改，删除，是否触发审计|
|5|行为审计：,CREATE PACKAGE    
  ，ALTER PACKAGE，    
  DROP PACKAGE|创建pkg.pipefunc，修改，删除，是否触发审计|
|6|行为审计：用法拦截：CREATE AUDIT POLICY up2 ACTIONS DELETE ON table（func),,INSERT ON table（func),,UPDATE ON table（func),,ALL ON table（func)|此用法不支持（普通func和pkg.func都覆盖）|
|7|行为审计：用法拦截：CREATE AUDIT POLICY up2 ACTIONS DELETE ON func,,INSERT ON func,,UPDATE ON func,,ALL ON func|此用法不支持（普通func和pkg.func都覆盖）|
|8|角色审计：,创建role，有,CREATE AUDIT POLICY up1 PRIVILEGES CREATE PROCEDURE,,CREATE ANY PROCEDURE,,ALTER ANY PROCEDURE,,DROP ANY PROCEDURE,,EXECUTE ANY PROCEDURE;权限|创建，修改，删除，调用pipe func，检查审计结果|
|9|  
|创建，修改，删除，调用pkg.pipe func,检查审计结果|
|10|权限相关的发散：,只有 PROCEDURE相关权限，执行select from pipe func能否成功？|  
|
|11|dba_tables等表视图中不可见|  
|


9、

新识别的加固点：

1、dbms_describe与pipelined函数，高级包或者pipelined函数信息无异常

2、视图测试：

|  
|视图|测试点|
|---|---|---|
|1|dba_procedures|创建全局/pkg.func pipelined函数时，字段有标记，删除pipelined函数后，无对应行|
|2|  
|创建pkg.func pipelined函数时，字段是否有标记，删除pipelined函数后，无对应行|
|3|  
|创建全局/pkg.func pipelined函数时，字段有标记，修改为非pipelined函数时，字段无标记|
|4|  
|创建pkg.func pipelined函数时，字段是否有标记，修改为非pipelined函数时，字段无标记|
|5|sys.procedure$，  OPTIONS字段|创建全局函数时，字段有标记，删除pipelined函数后，无对应行|
|6|  
|创建pkg.func pipelined函数时，字段是否有标记，删除pipelined函数后，无对应行|
|7|  
|创建全局/pkg.func pipelined函数时，字段有标记，修改为非pipelined函数时，字段无标记|
|8|  
|创建pkg.func pipelined函数时，字段是否有标记，修改为非pipelined函数时，字段无标记|
|9|dba_objects|创建pipelined函数可查|
|10|desc dba_source|创建pipelined函数可查|
|11|DBMS_METADATA.GET_DDL|高级包可查|


3、长稳用例

4、单行返回的数据规格，结合vmblock验证边界值，是否超出64k？

5、select中间时有异常，隐式转换到某一行时有异常（如隐式转换不支持，长度超出限制等），线程报异常，主线程的出错ifelse构造当。。。时，pipe row一个异常值

6、lob数据，in、out、temp构造不同场景的lob数据返回处理

7、内置函数优先，pipelined函数与内置函数重名，其他内置关键词发散，此处可能有特殊处理

8、pipe 空和满两种状态，读的速度，

执行内容，运算尽量复杂–可能会空

执行内容，运算很快但返回值多–可能会慢

9、pipelined的异常手动中断退出，检查资源是否正常释放，重点关注pipelined本身，确认下可查的资源视图，补充到测试设计中

关注视图：select * from V$PROCESS;（查询线程信息：    [V$PROCESS | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E7%B3%BB%E7%BB%9F%E8%A7%86%E5%9B%BE/%E5%8A%A8%E6%80%81%E8%A7%86%E5%9B%BE/V$PROCESS.html)    ）

select NAME,START_TIME,STATUS from V$PROCESS;

select * from V$VMSTAT;   （查询vm变化信息：    [V$VMSTAT | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.1/zh/%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E7%B3%BB%E7%BB%9F%E8%A7%86%E5%9B%BE/%E5%8A%A8%E6%80%81%E8%A7%86%E5%9B%BE/V$VMSTAT.html)    ）

 select SID,ALLOC_COUNT,FREE_COUNT,OPEN_COUNT,CLOSE_COUNT,CURR_OPEN,CURR_CLOSE from V$VMSTAT where ALLOC_COUNT <> 0;          

10、pipelined中有全局变量区，pkg其他变量的访问，场景是否支持？（yashan预计不支持，确认下oracle的行为）

11、占用并行线程池资源，可以构造--查询并行，修改并行参数degree，作用到与他关联的表上，检查生效情况，执行计划暂时无法与友商对齐

  


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

## Attachments:

[门槛.rar](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY1YTc4OTcwYzJhZjRmNTFlYjQyIiwicmVmX2lkIjoiNjczOTY1YTY1OTNmOTljOWZmMjMzNzQ5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzIzOTg2LCJleHAiOjE3ODI0MTAzODZ9.XE3wGNIb8cYoNM9ZhpPBpLSdo9b7qoxuCCj-hcydhPw)

 (application/octet-stream)    


## Comments:

|  [](null)  ,评审意见汇总：,1、pipelined函数执行DML，DML关联有触发器，区分下有无自治事务    
  2、在执行单元中循环改变数组的赋值，包括流程控制的循环，游标for循环两种    
  3、不支持返回数组+record，但是可以将record的值赋给其他变量，普通标量类型或object类型    
  4、子过程体中有dml语句时，验证与自治事务联动的场景：外有内无，外无内有，都有，都无    
  5、创建触发器时，表的位置传pipelined函数或table(pipelined func)    
  6、pipe row入参为自定义函数返回值，自定义函数中有无dml语句，有无自治事务，dml语句是否关联触发器    
  7、pipelined函数关联查询的对象为列表    
  8、性能测试时先对比普通函数执行相同数据处理时的性能，测试用数据在执行时做调整    
  9、dba_tables中查询pipelined函数不可见    
  10、权限审计需要覆盖read any table权限    
  11、结合vmblock，验证单行返回的最长边界值    
  12、构造select中途有异常的场景，如长度超出限制，到某一行时有隐式转换报错，使用ifelse在某行返回异常值    
  13、返回lob数据时，应关注in，out，temp lob的返回是否无异常    
  14、结合内置函数优先原则，构造pipelined函数与内置函数，内置关键字重名场景，检查生效优先级    
  15、执行内容，运算复杂时，可能出现pipe为空；执行内容，运算很快时，可能出现pipe占满，两种情况都要构造覆盖    
  16、pipelined的异常手动中断退出，检查资源是否正常释放，重点关注pipelined本身，关注可查视图V$VMSTAT，V$PROCESS，已补充到测试设计中    
  17、pipelined中有全局变量区，pkg其他变量的访问    
  18、alter session set DEGREE_OF_PARALLEL =x;修改并行参数，构造pipelined函数与普通表关联查询,Posted by dangwenqi at 九月 18, 2024 17:58|
|---|


差异场景记录：

|序号|场景|
|---|---|
|1|pipelined函数中有insert语句时，通过rownum < 5限制返回行数，pipelined函数返回值一致都是4行的情况下，yashan在目标表中插入了5行，oracle插入了4行,![clipbord_1732506436261.png](https://pingcode.yasdb.com/atlas/files/public/67452173a1ad9a3311de3707/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBRUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjM5ODYsImV4cCI6MTc4MjMzNDc4Nn0.S6f-KAhNsaKeCY8216ghoGFRyPioXN2wEzifKjPJLF4),  [test_sdv_ydbrd11623_227.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc0NTIxN2ZhMWFkOWEzMzExZGUzNzA4IiwicmVmX2lkIjoiNjczOTY1YTY1OTNmOTljOWZmMjMzNzQ5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzIzOTg2LCJleHAiOjE3ODI0MTAzODZ9.MdmuJfaiM7GkDxVsygN8mRtP7KnBbZnwTFmi0daQdOY)  ,结论：,from 峰哥：,你可以把pipe函数看成是一张临时表，然后where rownum < 5 作用的是SQL语句投影出来的条目数；投影的条目数并不会影响表中的条目数吧？,,pipe线程是独立的跟主线程没有关系；主线程在收到足够数据，决定停止执行SQL告诉pipe函数可以停了，此时pipe函数执行了多少次，主要看这个异步线程的执行速度；目前看到是5次，不同执行环境上可能就变化了。|


