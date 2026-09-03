Created by 邓秋怡, last modified by  未知用户 (liaofeng) on 一月 29, 2024

#   [DBMS_UTILITY.EXEC_DDL_STATEMENT方案设计](#dbms-utilityexec-ddl-statement方案设计)  

SR链接：

  [YDBRD-22160](https://jira.yasdb.com/browse/YDBRD-22160?src=confmacro)    -  支持DBMS_UTILITY.EXEC_DDL_STATEMENT函数  完成

  


##   [1. Overview（概述）](#1-overview概述)  

EXEC_DDL_STATEMENT是文件操作高级包DBMS_UTILITY下的一个子函数，用于执行DDL语句。

##   [2. Features（功能特性）](#2-features功能特性)  

###   [2.1 Syntax（语法）](#21-syntax语法)  

```
DBMS_UTILITY.EXEC_DDL_STATEMENT (
 parse_string IN VARCHAR2);


```

###   [2.2 Parameter（参数）](#22-parameter参数)  

|参数|参数类型|数据类型|是否必填|默认值|说明|
|---|---|---|---|---|---|
|parse_string|IN|VARCHAR2|是|-|待执行的DDL语句|


|入参|执行结果|
|---|---|
|空|PLS-00306: 调用 'EXEC_DDL_STATEMENT' 时参数个数或类型错误|
|显式NULL|ORA-06561: 程序包 DBMS_SQL 不支持给定的语句[报错信息包含了DBMS_UTILITY和DBMS_SQL，感觉是oracle内部实现有点问题]|
|非字符串类型|ORA-00900: 无效 SQL 语句|
|字符串类型但完全不是sql语句|ORA-00900: 无效 SQL 语句|
|DDL结尾有分号|ORA-00922: 选项缺失或无效|
|多条DDL，中间用分号进行分割|ORA-00922: 选项缺失或无效（估计是因为中间识别到分号了）|
|非DDL，sql语句本身不合法（例：select不存在的表）|子函数执行出错，非ddl编译出错，报非ddl编译时的错误 【plsql用exception可捕获】|
|非DDL，sql语句本身合法|子函数执行成功，非ddl编译成功，但未执行|
|DDL，sql语句本身不合法（例：create已存在的表）|子函数执行出错，根据ddl本身编译执行的报错位置进行报错 【plsql用exception可捕获】|
|DDL，sql语句本身合法|子函数执行成功，且ddl语句编译执行成功|
|varchar变量，且变量内存的是合法ddl|子函数执行成功，且ddl语句编译执行成功|
|varchar变量，且变量内存的是合法非ddl|子函数执行成功，非ddl编译成功，但未执行|
|多条sql一起执行   begin..end （例：匿名块中有条insert触发唯一主键约束的语句，对匿名块来说是编译不报错，执行报错）|子函数执行成功与否取决于  匿名块编译结果。匿名块本身不执行|
|带procedure  begin..end内含procedure|子函数执行成功与否取决于  匿名块及其内部的proc编译结果。匿名块本身不执行|


###   [2.3 返回值](#23-返回值)  

无。

##   [3. Interfaces（接口）](#3-interfaces接口)  

static CodResult bipVerifyExecDdlStatement(AnlVerifier* vrfr, ExprNode* node)    
  static CodResult bipConcludeExecDdlStatement(AnlStmt* stmt, ExprNode* node, TypeDesc* retType)    
  static CodResult bipExecExecDdlStatement(SoExecutor* exec, AnlContext** context)

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

- 只支持单机和集群（暂不支持分布式）。
- 只支持DDL语句的执行，非DDL只编译不执行。


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

1. 校验入参parse_string的合法性（只有参数个数错误时才编译阶段报错）
1. bipExecExecDdlStatement中用anlPrepare2进行语句编译校验
1. 判断是否为DDL语句，不是则返回，并不抛出任何异常
1. 是DDL则进行anlExecute。


###   [5.1 Architecture（架构）](#51-architecture架构)  

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

1、常规测试：parse_string分别是合法的ddl,dml,dcl,dql。    
  2、参数测试：空、显式NULL、非NULL但非VARCHAR类型、非NULL且是VARCHAR但是不是合法的sql语句。    
  3、非DDL语句测试（会编译但不执行。含begin..end。含begin proc end测试）    
  4、DDL语句测试    
  【详见    [DBMS_UTILITY.EXEC_DDL_STATEMENT调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=133570930)    】

##   [7. Document（资料）](#7-document资料)  

  [Oracle Database 19c DBMS_UTILITY文档](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/database-pl-sql-packages-and-types-reference.pdf)  

##   [8. Workload（工作量）](#8-workload工作量)  

工作量1周

##   [9. TODO（遗留问题）](#9-todo遗留问题)  