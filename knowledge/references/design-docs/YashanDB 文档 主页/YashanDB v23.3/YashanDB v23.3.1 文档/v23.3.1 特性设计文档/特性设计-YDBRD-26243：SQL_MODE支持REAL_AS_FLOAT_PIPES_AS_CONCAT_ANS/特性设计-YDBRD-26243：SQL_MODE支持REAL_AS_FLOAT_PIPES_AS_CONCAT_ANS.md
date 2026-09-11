Created by 马士杰, last modified on 八月 27, 2024

*详细设计-YDBRD26243/26240/26239*

*SR链接：*    [SQL_MODE支持REAL_AS_FLOAT](https://pingcode.yasdb.com/pjm/items/6619044afd997db58ad87bd7? #YDBRD-26243 SQL_MODE支持REAL_AS_FLOAT)  

*               *    [SQL_MODE支持PIPES_AS_CONCAT](https://pingcode.yasdb.com/pjm/items/66190382fd997db58ad879df? #YDBRD-26240 SQL_MODE支持PIPES_AS_CONCAT)  

  [SQL_MODE支持ANSI_QUOTES](https://pingcode.yasdb.com/pjm/items/66190298fd997db58ad876ec? #YDBRD-26239 SQL_MODE支持ANSI_QUOTES)  

  


  


##   [1. 总述](#1-总述)  

支持SQL_MODE中的三种mode的设置。REAL_AS_FLOAT/PIPES_AS_CONCAT/ANSI_QUOTES。SQL_MODE是否设置的表现都应该与MySQL的表现一致

yashan兼容的sqlmode通过CodUint64保存，挂在stmt->handler->sesParamCtx.compatParams

###   [1.1 需求来源](#11-需求来源)  

Mysql兼容性支持    
  支持形态：单机

###   [1.2 调研文档](#12-调研文档)  

调研文档见    [https://conf.yasdb.com/pages/viewpage.action?pageId=150627579](https://conf.yasdb.com/pages/viewpage.action?pageId=150627579)  

###   [1.3 需求分析](#13-需求分析)  

MySQL通过sqlmode控制不同的客户端应用不同的sql模式。之前sqlmode只做语法兼容，本需求实现sqlmode的修改，查询，生效。

MySQL的sqlmode查询出的结果是一系列字符串，代表对应的sqlmode是否生效。

实现REAL_AS_FLOAT/PIPES_AS_CONCAT/ANSI_QUOTES三类sqlmode。

##   [2. 接口](#2-接口)  

1.增加mySqlModeToText和myTextToSqlMode。

myTextToSqlMode传入一个text，解析成对应的sqlmode

mySqlModeToText传入一个CodUint64，还原为对应的text文本

2.增加一个myGetSqlModeStatus接口，通过传入一个CodUint64和一个MySqlModeId，返回该id对应的sqlmode是否生效。

##   [3. 规格与约束](#3-规格与约束)  

sqlmode的语法规格：

sqlmode的设置语法为：

set sql_mode = 'text,text...';

或

set sql_mode = '';

其中的text必须为存在的sql_mode,当不指定任何内容时，视为将所有sqlmode置为false

sqlmode的查询语法为：

select @@sql_mode;

当出现不存在的sqlmode时，报错处理

REAL_AS_FLOAT 默认值为false

PIPES_AS_CONCAT 默认值为true

ANSI_QUOTES 默认值为false

与Mysql差异：

1. 目前只支持REAL_AS_FLOAT/PIPES_AS_CONCAT/ANSI_QUOTES。NO_ZERO_DATE和NO_ZERO_IN_DATE已经通过内部参数的形式支持，暂时没有适配和sqlmode的转换。


2.yashan储存带双引号的表名时会把双引号作为表名的一部分储存，把    `table`     和"table"视为两个表

而MySQL视为相同的表

##   [4. 特性](#4-特性)  

###   [4.1 特性设计](#41-特性设计)  

1.增加MY_TOKEN_REAL

现在的real类型在parse的时候会直接视为ANL_TOKEN_DOUBLE，直接与double类型等价。

需要先增加一个MY_TOKEN_REAL，在myParseDataType时根据sqlmode判断要将其解析为double还是float。

如果没有指定则解析为double，若指定了则视为float，其余的parse流程与yashan原本的double/float一致。

2.在CompatLexer上增加一个compatParams，在MySQL兼容的场景下实际等于sqlmode。

3.在myLexReadOper中增加myLexReadConcat，用于解析 || 和|

在双竖线的场景下，如果指定了MY_PIPES_AS_CONCAT，则将该双引号视为concat，否则视为or。

4.在myLexReadOper中的双引号场景下，增加对ansiQuotes的判断，如果指定了ANSI_QUOTES，则使用myFetchVariantItem解析双引号，否则按照普通的逻辑处理。

5.在视图中

在建立视图时会报错当前所使用的sqlmode，保存在viewDesc上，在kcbParseViewText时使用创建视图时的sqlmode，保证一致性

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

## Attachments:

[image2024-6-6_21-3-55.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZDY4OTcwYzJhZjRmNTIxYmM5IiwicmVmX2lkIjoiNjczOTZlZDY3MjgyMDZlZmI5MmYyZDQ5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0MzM3LCJleHAiOjE3ODI1MzA3Mzd9.DGDEw-k5cCaPf6QEYScW4KDtjiXNkQIEiexKdotSYoY)

 (image/png)    


[image2024-6-6_21-14-17.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZDY4OTcwYzJhZjRmNTIxYmNhIiwicmVmX2lkIjoiNjczOTZlZDY3MjgyMDZlZmI5MmYyZDQ5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0MzM3LCJleHAiOjE3ODI1MzA3Mzd9.WpUfbPy8IpmZf6UXEdwrNwYYufqv8F4fQxqJTeHoilc)

 (image/png)    


[image2024-6-6_21-14-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZDZhMWFkOWEzMzExZGM5YTNkIiwicmVmX2lkIjoiNjczOTZlZDY3MjgyMDZlZmI5MmYyZDQ5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0MzM3LCJleHAiOjE3ODI1MzA3Mzd9.9uuOC6l_IRg8_7XOA-xSF2CXH-JND9Yu1KhTs7s6u7g)

 (image/png)    


## Comments:

|  [](null)  ,双引号场景下不能直接修改原始文本,Posted by mashijie at 六月 07, 2024 10:17|
|---|
|  [](null)  ,2.双引号分开转测,3.表达式的default，1||2 ，以建表时的sqlmode为准,4.MY_PIPES_AS_CONCAT默认值,Posted by mashijie at 六月 07, 2024 10:32|
