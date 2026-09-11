Created by 朱月婷, last modified on 七月 10, 2024

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/6674d4330b97847020f7bd53](https://pingcode.yasdb.com/pjm/items/6674d4330b97847020f7bd53)    *?*    
  *#YDBRD-29536 开发任务：支持Last_Insert_ID()函数*

##   [1. 总述](#1-总述)  

支持last_insert_id()函数，返回上一个有表达式的函数或自增的结果值。

在yashan中，当一列的default为seq，且为primary key时，视为自增。

###   [1.1 需求来源](#11-需求来源)  

略

###   [1.2 调研文档](#12-调研文档)  

  [https://conf.yasdb.com/pages/viewpage.action?pageId=156113147](https://conf.yasdb.com/pages/viewpage.action?pageId=156113147)  

###   [1.3 需求分析](#13-需求分析)  

该函数的返回值依赖最近插入的表的auto_increment字段，由于Yashan不支持auto_increment功能，故当建表时出现列属性为默认值自增seq及列为索引的第一列，视为自增。

由于该函数跟session相关，故将在handler上挂一个Int64的变量（mysql应为int64，为负数时会翻转为最大值）。

###   [1.4 数据字典](#14-数据字典)  

无

###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|last_insert_id()|----|是|
|SQL语法|last_insert_id(expr)|----|是/否|


##   [3. 规格与约束](#3-规格与约束)  

-     1. mysql中该函数的返回值为uint64，yashan为int64。

-     1. 暂未支持auto_increment关键字，客户场景使用default sequence作为主键默认值，且不显示插入主键值

-     1. 当参数为小数时，四舍五入进行输出（Mysql中如果是字符串小数，去尾法）。

-     1. 单条语句插入多行时，该函数的返回值以第一行的对应自增值一致。

-     1. 仅支持行表。



##   [4. 特性](#4-特性)  

###   [4.1 isAutoInCrement](#41-isautoincrement)  

当列定义默认值为seq（不区分自增自减），且为主键时，认为该列为自增列。

实现：

1. columnDef和AnkColumnAttr上新增isAutoInCrement，在verifyCreateTable阶段seqInDefault为true且在consList中找到该列时，赋为true；并在execCreateTable时赋值给ankColumn。
1. 在执行单行insert时，根据ankColumn该标志位，将执行值赋值到handler上；在执行multiInsert时，定义局部变量，只对第一行的数据进行赋值。
1. 当执行alter语句修改时，需判断是否也满足上述条件，对该值进行维护。


*当前问题*  ：该属性需要持久化，涉及升级等内容，是否建议这么做。

###   [4.2 函数处理](#42-函数处理)  

该功能按照内置函数处理，最多能有一个参数，最少0个参数；

无参数情况下，返回handler对应int64数值。

有参数情况下，将参数转为int64(mysql为uint64），如果是小数，则四舍五入，如果转换失败，则返回零；并更新handler上对应值。

新增接口：

CodResult bifVerifyLastInsertId(AnlVerifier* vrfr, ExprNode* func);

CodResult bifConcludeLastInsertId(AnlStmt* stmt, ExprNode* func, TypeDesc* retType);

CodResult bifExecLastInsertId(AnlStmt* stmt, ExprNode* func, Variant* retValue);

*当前问题*  ：sequence的返回类型是number，如果转bigint报错，如溢出等错误，是否将该值置为0？

导入工具触发自增会更新该值吗？以什么为准？

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 通过alter语句修改列的默认值及index，检查last_insert_id（）生效情况。
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Comments:

|  [](null)  ,MySQL update 自增列，last_insert_id是否变化,Posted by zhuyueting at 七月 02, 2024 17:45|
|---|
