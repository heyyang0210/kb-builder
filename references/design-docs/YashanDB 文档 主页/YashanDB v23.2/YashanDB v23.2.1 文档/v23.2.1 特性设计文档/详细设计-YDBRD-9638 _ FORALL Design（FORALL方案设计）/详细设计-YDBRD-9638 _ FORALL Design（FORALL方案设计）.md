Created by 邓秋怡, last modified on 十一月 23, 2023

*详细设计-YDBRD-9638 : FORALL Design（FORALL方案设计）*

* IR链接：*    [YDBRD-9638](https://jira.yasdb.com/browse/YDBRD-9638?src=confmacro)    *-*  *支持FORALL功能*  *完成*

*SR链接：*    [YDBRD-13364](https://jira.yasdb.com/browse/YDBRD-13364?src=confmacro)    *-*  *支持FOR ALL语句save excpetions*  *完成*    [YDBRD-13363](https://jira.yasdb.com/browse/YDBRD-13363?src=confmacro)    *-*  *支持FOR ALL语句对接INSERT*  *完成*    [YDBRD-13365](https://jira.yasdb.com/browse/YDBRD-13365?src=confmacro)    *-*  *支持FOR ALL语句对接UPDATE和DELETE*  *完成*

##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

需求来源：产品化需求

场 景：在PLSQL循环中可以批量执行语句

需求描述：支持FORALL功能

需求范围：1、单机和集群 2、行表

需求规格：支持forall_statement，语法如下forall_statement ::=

```
FORALL index IN bounds_clause [ SAVE EXCEPTIONS ] dml_statement;

```

bounds_clause ::=

```
{ lower_bound .. upper_bound
| INDICES OF collection [ BETWEEN lower_bound AND upper_bound ]
| VALUES OF index_collection
}

```

###   [1.2 调研文档](#12-调研文档)  

  [FORALL调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=135603008)      
  关键点如下：    
  1、隐式游标初始化时间：进入forall并且开始执行dml后。且隐式游标一旦被赋值则不会因回滚而回退。    
  2、设置SAVE EXCEPTIONS后，DML语句执行错误后会返回统一的错误码（24381），具体错误信息在隐式游标中查看。且此时不会回滚数据。    
  3、SAVE EXCEPTIONS只能处理dml层面的错误。collection(i)越界是forall层面的错，也就是即使有SAVE EXCEPTIONS但是执行时越界了，执行会立即停止，且抛出的是越界错误码而不是forall的统一错误码。    
  4、匿名块是否回滚取决于执行完整个匿名块后抛出的错误码是否为FORALL统一错误码。    
  5、FORALL中DML执行的条数：由有无SAVE EXCEPTIONS和COLLECTION(I)越界共同决定。（没有SAVE EXCEPTIONS遇到错误，立即停止。有SAVE EXCEPTIONS且没有COLLECTION(I)越界，会执行完。有SAVE EXCEPTIONS但是COLLECTION(I)越界，立即停止。）    
  5、隐式游标sql%bulk_rowcount。在BOUND_CLAUSE为left..right时，会先初始化right-left+1个值为0的空间待使用。在BOUND_CLAUSE为其他情况时，不进行空间初始化，执行一条DML开辟一个空间并赋值一次。    
  6、隐式游标sql%bulk_exceptions。存储DML层面或FORALL层面的异常信息。FORALL层面优先级高于DML层面（即一旦遇到FORALL层面的异常，会清空当前DML层面的所有异常后重新赋值）。    
  7、index在dml_statement中存在且仅以varray(index)的形式存在

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|FORALL批量执行|1. 识别forall关键字区别for，不走原for的逻辑，需要新增逻辑
1. 增加ForAllLn，循环获取下一个index执行statement，每次循环将异常信息、影响行数赋值给隐式游标。
1. 循环执行前越界判断。
    1. 如果越界，清空SQL%BULK_EXCEPTIONS后赋值当前越界信息。然后跳出循环。
1. statement执行。若成功则下一次循环。若失败则：
    1. 如果没有SAVE EXCEPTIONS直接返回。（没有SAVE子句时SQL%BULK_EXCEPTIONS.COUNT = 1）。
    1. 如果有SAVE EXCEPTIONS保存statement的索引和错误码到SQL%BULK_EXCEPTIONS对应的array，执行完后返回固定的一个错误码。
|是|是|
|功能|SAVE EXCEPTIONS|1. 在执行完当前dml后若失败，存储当前失败信息后cleanCurError，然后继续执行。
1. dml执行完毕后抛出FORALL指定错误码。
1. 匿名块结束后进行处理时，对抛出FORALL指定错误码的匿名块跳过回滚。
|是|是|
|功能|lower_bound .. upper_bound|1. 作为FORALL内部dml循环次数的关键依据
|是|是|
|功能|sql%bulk_rowcount|1. 添加游标定义，游标类型为DTYPE_UDT_ARRAY,数组元素为INTEGER
1. 编译过程中记录sql%bulk_rowcount（expr）的expr信息
1. 赋值过程    

    1. normal情况下，在FORALL执行开始即预先开辟空间，FORALL执行过程中直接赋值
    1. 其他情况下，一边开辟空间一边赋值
1. 执行过程中根据expr变量值去隐式游标变量中取值。
|是|是|
|功能|sql%bulk_exceptions|1. 添加游标定义，游标类型为DTYPE_UDT_ARRAY，数组元素为record，record有两列，分别是ERROR_CODE、ERROR_INDEX。
1. 编译过程中记录subId，用于标识count|ERROR_CODE|ERROR_INDEX
1. 赋值过程一边开辟空间一边赋值
1. 执行过程中根据subId去隐式游标变量中取值。
|是|是|
|功能|绑定参数，index在dml_statement中存在且仅以varray(index)的形式存在|1. 编译阶段即判断，在所有可能出现形式为varray(index)的编译函数中，都进行一次判断。如果出现，给索引List添加一个成员。
1. FORALL编译结束前，判断索引List是否为空，空则说明index并未作为collection索引出现过，报错。
1. FORALL编译结束前，对所有的输入参数做校验，校验index是否单独出现过，若单独出现过，报错。
|  
|  
|
|功能|循环执行前越界判断|1. 在编译阶段用一个  **索引List，**  记录index作为索引出现的每一个位置
1. 在执行阶段，将索引List元素  **值作为下标**  ，去输入变量中通过  **listGet(输入变量List，索引List元素值)**  取出每一个varray变量。再判断当前varray中下标index时，是否有值，没有则越界。
|是|是|
|性能|批量执行DML语句|ORACLE上DML是INSERT时，执行时间会极大缩短，UPDATE、DELETE、MERGE的时间变化不大。yasdb执行时候和普通的FOR循环不会有明显变化。|否|是|
|可用性|  
|  
|  
|否|
|可靠性|  
|  
|  
|否|
|可维可测|  
|  
|  
|否|
|安全|  
|  
|  
|否|
|易用性|  
|  
|  
|否|
|可修改性|  
|  
|  
|否|
|兼容性|  
|  
|  
|否|
|周边配合|权限|  
|  
|  
|
|周边配合|审计|  
|  
|  
|
|周边配合|导入导出工具|  
|  
|  
|


###   [1.4 数据字典](#14-数据字典)  

无

###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|FORALL关键字可用|----|是|
|函数|  
|  
|否|
|高级包|  
|  
|否|
|系统视图|sys.v$RESERVED_WORDS查询结果会多一行FORALL关键字信息|----|是|
|动态视图|  
|  
|否|
|配置参数|  
|  
|否|
|驱动接口|  
|  
|否|
|错误码|ERR_PL_FORALL_DML_ERRORS,ERR_PL_FORALL_EXCEPTION_INIT_ERRORS,ERR_PL_FORALL_IN_BIND_ERRORS,ERR_PL_FORALL_I_ISOLATE_ERRORS|FORALL有SAVE EXCEPTIONS时内部dml出错时会抛出此错误码,引用了FORALL特有的但未进行初始化的隐式游标,FORALL的dml中没有出现COLLECTION(I)的绑定,FORALL的dml中index单独出现|是|
|告警|  
|  
|否|
|日志|  
|  
|否|


##   [3. 规格与约束](#3-规格与约束)  

- values of 和indices of暂未支持


##   [4. 特性](#4-特性)  

###   [4.1 FORALL批量执行](#41-forall批量执行)  

![](https://pingcode.yasdb.com/atlas/files/public/67396c9ca1ad9a3311dc8bb4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQVFBQUFBQUFBQUFBQUFBQUFJQUFBQUFnQUFBQUFBQUFBUUFBQUFBQUFCQUFBQUFBQUFBUWdBQUFBQUVBQUFBQUFBQUVBQUFBQUVBRUFBQUFBQ0FBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDE4NzEsImV4cCI6MTc4MjMxMjY3MX0.Mr-zk3VNRjRmYq0USHDVCufydm3dp0h5OVQCKgszKXM)

###   [4.2 SAVE EXCEPTIONS](#42-save-exceptions)  

1、在执行完当前dml后若失败，存储当前失败信息后cleanCurError，然后继续执行。    
  2、dml执行完毕后抛出FORALL指定错误码。    
  3、匿名块结束后进行处理时，对抛出FORALL指定错误码的匿名块跳过回滚。

![](https://pingcode.yasdb.com/atlas/files/public/67396c9c8970c2af4f520d45/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQVFBQUFBQUFBQUFBQUFBQUFJQUFBQUFnQUFBQUFBQUFBUUFBQUFBQUFCQUFBQUFBQUFBUWdBQUFBQUVBQUFBQUFBQUVBQUFBQUVBRUFBQUFBQ0FBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDE4NzEsImV4cCI6MTc4MjMxMjY3MX0.Mr-zk3VNRjRmYq0USHDVCufydm3dp0h5OVQCKgszKXM)

###   [4.3 lower_bound .. upper_bound](#43-lower-bound--upper-bound)  

和FOR类似，是限制dml执行次数的关键因素，每次循环前会对index是否在此区间进行判断，是才继续循环。

###   [4.4 sql%bulk_rowcount](#44-sqlbulk-rowcount)  

在BOUND_CLAUSE为left..right时，会先初始化right-left+1个值为0的空间待使用。在BOUND_CLAUSE为其他情况时，不进行空间初始化，执行一条DML开辟一个空间并赋值一次。

###   [4.5 sql%bulk_exceptions](#45-sqlbulk-exceptions)  

1、每次执行dml前提前判断是否会COLLECTION(I)越界，如果越界则清空sql%bulk_exceptions后再赋值当前越界信息。    
  2、每次执行dml后，判断是否失败，是则给对应index处的sql%bulk_exceptions赋值。

![](https://pingcode.yasdb.com/atlas/files/public/67396c9d8970c2af4f520d46/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQVFBQUFBQUFBQUFBQUFBQUFJQUFBQUFnQUFBQUFBQUFBUUFBQUFBQUFCQUFBQUFBQUFBUWdBQUFBQUVBQUFBQUFBQUVBQUFBQUVBRUFBQUFBQ0FBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDE4NzEsImV4cCI6MTc4MjMxMjY3MX0.Mr-zk3VNRjRmYq0USHDVCufydm3dp0h5OVQCKgszKXM)

###   [4.6 绑定参数，index存在形式【初步实现 带详细自测】](#46-绑定参数index存在形式初步实现-带详细自测)  

- 普通dml将变量存在ForAllLn->dmlSql.inputVars。Execute immediate语句的绑定参数存在ForAllLn->execSql.usingClause.vars。
- 编译阶段用soTryForAllSet函数（在varray(index)形式可能出现的位置调用）和soTryForAllExecuteSet函数（在execute immediate的using vars部分用 ）给索引List赋值
- FORALL编译结束前，判断索引List是否为空，空则说明index并未作为collection索引出现过，报错。
- FORALL编译结束前，soForAllLnCheck对所有的输入参数做校验，校验index是否单独出现过，若单独出现过，报错。


###   [4.7 循环执行前越界判断](#47-循环执行前越界判断)  

- 在编译阶段用一个索引List，记录index作为索引出现的每一个位置（4.6中第2点）
- 在执行阶段，将索引List元素值作为下标，去输入变量中通过listGet(输入变量List，索引List元素值)取出每一个varray变量。再判断当前varray中下标index时，是否有值，没有则越界。


###   [4.7 特性可维可测设计](#47-特性可维可测设计)  

###   [4.8 特性安全设计](#48-特性安全设计)  

###   [4.9 特性周边配合](#49-特性周边配合)  

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

1、index    
  2、bounds_clause（normal）：变量类型测试、表达式范围测试、空测试、进入循环的条件测试    
  3、Save exceptions：有无    
  4、dml_statement：单条测试、多条测试、非dml测试、dml测试    
  5、绑定参数：对集合的简单引用6、index存在形式：存在且仅能以collection(i)的形式存在    
  7、隐式游标：初始化时间、全部个数、有效个数、是否随着匿名块回滚而回滚    
  8、抛出的错误码与回滚    
  9、覆盖forall相关错误码

##   [6.资料设计章节](#6资料设计章节)  

##   [7.未来规划](#7未来规划)  

## Attachments:

[image2023-11-20_17-24-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjOWM4OTcwYzJhZjRmNTIwZDQyIiwicmVmX2lkIjoiNjczOTZjOWM1OTNmOTljOWZmMjM3MGRkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxODcxLCJleHAiOjE3ODIzODgyNzF9.MsFd4QWm7UhAvLKuYsJbQcQBgCwF1VMPBulBX_TwyU0)

 (image/png)    
