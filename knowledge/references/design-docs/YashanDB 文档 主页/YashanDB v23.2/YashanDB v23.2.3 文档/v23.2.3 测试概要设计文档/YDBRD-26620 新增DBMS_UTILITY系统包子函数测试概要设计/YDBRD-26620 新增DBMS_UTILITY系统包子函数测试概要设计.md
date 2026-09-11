Created by 刘美秀, last modified on 五月 31, 2024

IR链接：    [https://pingcode.yasdb.com/ship/ideas/66164a89009f91eb87f36f1a](https://pingcode.yasdb.com/ship/ideas/66164a89009f91eb87f36f1a)    ?    
  #YASHAN-2829 新增DBMS_UTILITY系统包子函数

##   [1. 需求概述](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#1-%E9%9C%80%E6%B1%82%E6%A6%82%E8%BF%B0)  

需求概述：  增加DBMS_UTILITY内置系统包函数

需求来源：  产品化需求-ORACLE兼容场景，提供了多种工具类子程序

部署形态：  单机、分布式和集群

需求场景：  提供了多种工具类子程序

  


开发设计：    [YDBRD-26620: 新增DBMS_UTILITY系统包子函数](https://conf.yasdb.com/pages/viewpage.action?pageId=153015229)  

##   [2. 功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#2-%E5%8A%9F%E8%83%BD%E7%82%B9)  

- GET_HASH_VALUE
- GET_TIME
- FORMAT_ERROR_BACKTRACE
- COMMA_TO_TABLE
- TABLE_TO_COMMA
- ACTIVE_INSTANCES
- CURRENT_INSTANCE
- DB_VERSION
- GET_ENDIANNESS
- GET_PARAMETER_VALUE
- GET_SQL_HASH
- IS_BIT_SET
- IS_CLUSTER_DATABASE
- NAME_RESOLVE
- NAME_TOKENIZE
- OLD_CURRENT_SCHEMA
- OLD_CURRENT_USER
- PORT_STRING


涉及视图：  V$SQLAREA、V$SESSION

#   [3. 规格约束](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#3-%E8%A7%84%E6%A0%BC%E7%BA%A6%E6%9D%9F)  

|规格/约束|描述|说明|备注|
|:---|:---|:---|:---|
|规格|table_to_comma 关联数组中的table不进行校验，可以是任意字符串，即不合法的对象名|表现同oracle|  
|
|规格|comma_to_table，对于uncl_array则每个name的格式为     **a [. b [. c ]][ @ d ]**  。 对于lname_array格式为:  **a [. b]***  . 并对a,b,c,d这些name进行命名合法性校验|  
|  
|
|规格|name_tokenize，输入的一般格式为     **a [. b [. c ]][@ dblink ]**  ， 如果出现 'a.b.c bc'字符串中有空格这样的输入，则会在空格处停止|  
|  
|
|规格|get_parameter_value的 listno始终为 1，指定为其他值也返回唯一结果。|yashandb不存在可以多次指定值的参数|


##   [4. 主要应用场景](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#4-%E4%B8%BB%E8%A6%81%E5%BA%94%E7%94%A8%E5%9C%BA%E6%99%AF)  

参考以上需求场景描述

##   [5. 概要测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#5-%E6%A6%82%E8%A6%81%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

###   [5.1 功能测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#51-%E5%8A%9F%E8%83%BD%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

**通用接口验证**

入参校验：参数个数（多参、少参、无参）、参数类型（正确、不正确）、参数顺序、入参值-数据长度、数据为空、数据错误

**业务逻辑验证**

  


**部署验证-单机、分布式、集群**

分布式高级包消息一致性

主备下，对过程体对象DDL，备升主后状态是否一致

  


**特性交互**

DBMS_JOB

绑定参数、子查询在PLSQL中场景覆盖。包括绑定参数给值是UDT

节点验证：DN/MN/CN执行

权限

审计

###   [5.2 DFX测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#52-dfx%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

|类型|测试项|
|:---|:---|
|并发|DDL/DML时 执行|
|HA|主备执行|


##   [6. 测试策略](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#6-%E6%B5%8B%E8%AF%95%E7%AD%96%E7%95%A5)  

|测试项|自动化看护|框架|
|:---|:---|:---|
|功能|是|yasft|
|业务|否|  
|
|DFX|是|dst_ha_test|
|性能|否|  
|


##   [7. 后续关注(可选)](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#7-%E5%90%8E%E7%BB%AD%E5%85%B3%E6%B3%A8%E5%8F%AF%E9%80%89)  

*NONE*