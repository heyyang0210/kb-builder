Created by 刘美秀, last modified on 五月 22, 2024

IR链接：    [https://pingcode.yasdb.com/ship/ideas/660b74c5009f91eb87f2ceb8](https://pingcode.yasdb.com/ship/ideas/660b74c5009f91eb87f2ceb8)    ?    
  #YASHAN-2227 支持DBMS_APPLICATION_INFO内置系统包

##   [1. 需求概述](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#1-%E9%9C%80%E6%B1%82%E6%A6%82%E8%BF%B0)  

需求概述：  增加DBMS_APPLICATION_INFO内置系统包

需求来源：  产品化需求-兼容oracle

部署形态：  单机

需求场景：  支持DBMS_APPLICATION_INFO内置系统包，可以向数据库注册应用程序名称以用于审核或性能跟踪目的

  


开发设计：    [YDBRD-26618 支持DBMS_APPLICATION_INFO内置系统包 - 林俊喆 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=153006049)  

##   [2. 功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#2-%E5%8A%9F%E8%83%BD%E7%82%B9)  

- DBMS_APPLICATION_INFO.READ_CLIENT_INFO：读取当前会话的字段的值client_info，V$SESSION的CLIENT_INFO
- DBMS_APPLICATION_INFO.READ_MODULE：读取  当前会话的模块和操作字段，  V$SQLAREA的MODULE和ACTION
- DBMS_APPLICATION_INFO.SET_ACTION：设置  当前模块中当前操作的名称
- DBMS_APPLICATION_INFO.SET_CLIENT_INFO：设置会话的字段的值client_info
- DBMS_APPLICATION_INFO.SET_MODULE：设置会话  模块名称
- V$SESSION新增字段：CLIENT_INFO


涉及视图：  V$SQLAREA、V$SESSION

#   [3. 规格约束](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#3-%E8%A7%84%E6%A0%BC%E7%BA%A6%E6%9D%9F)  

1. SET_ACTION输入的action_name超过32字节截断
1. SET_CLIENT_INFO输入的client_info超过64字节截断
1. SET_MODULE输入的module_name超过48字节截断，action_name超过32字节截断
1. 设置的字段如果在过程体结束后没被设置成null，后续操作也会使用相同字段，直到会话退出。
1. 支持部署模式：单机


##   [4. 主要应用场景](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#4-%E4%B8%BB%E8%A6%81%E5%BA%94%E7%94%A8%E5%9C%BA%E6%99%AF)  

参考以上需求场景描述

##   [5. 概要测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#5-%E6%A6%82%E8%A6%81%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

###   [5.1 功能测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#51-%E5%8A%9F%E8%83%BD%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

入参校验：参数个数（多参、少参、无参）、参数类型（正确、不正确）、参数顺序、入参值-数据长度、数据为空、数据错误

部署验证：单机、拦截-分布式/集群

资料补齐

*用户权限*

*COMMAND_TYPE：*

*SQL的命令类型*  *  
*  ** 1：SQL_QUERY*  *  
*  ** 2：SQL_INSERT*  *  
*  ** 3：SQL_UPDATE*  *  
*  ** 4：SQL_DELETE*  *  
*  ** 5：SQL_MERGE*  *  
*  ** 6：SQL_WITH*  *  
*  ** 7：SQL_ANONYMOUS_BLOCK*

  


  


###   [5.2 DFX测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#52-dfx%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

|类型|测试项|
|:---|:---|
|并发|DDL/DML时 set/read|
|HA|主机设置后，备机也能查询到设置|


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