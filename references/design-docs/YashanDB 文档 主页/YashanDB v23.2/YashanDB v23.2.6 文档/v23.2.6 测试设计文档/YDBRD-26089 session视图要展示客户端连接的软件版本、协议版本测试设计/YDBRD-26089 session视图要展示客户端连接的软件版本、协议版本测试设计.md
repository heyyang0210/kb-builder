Created by 罗爽, last modified on 九月 20, 2024

# 1. 概述

session视图新增展示各连接对应的客户端软件版本、协议版本 2.登陆日志打印相关的版本信息。

# 2. 需求分析

SR：    [https://pingcode.yasdb.com/pjm/items/6617cd1dfd997db58ad7a494](https://pingcode.yasdb.com/pjm/items/6617cd1dfd997db58ad7a494)    ?    
  #YDBRD-26089 session视图要展示客户端连接的软件版本、协议版本

开发设计文档：    [YDBRD-26089 session视图展示客户端连接的软件版本、协议版本](167159787.html)  

## 2.1 功能分析

1）GV/DV/V$SESSION增加n个字段：

|字段|类型|说明|
|:---|:---|:---|
|CLIENT_PROTOCAL_VERSION|BIGINT|客户端协议版本|
|CLIENT_VERSION|VARCHAR(256)|客户端软件版本|
|PROCESS|VARCHAR2(8)|操作系统客户端PID|
|MACHINE|VARCHAR2(256)|操作系统机器名|
|PORT|INTEGER|客户端端口号（无需加在协议上）|
|TERMINAL|VARCHAR2(256)|操作系统终端名|
|CLIENT_DRIVER|VARCHAR2(256)|客户端驱动名|


2）驱动需要适配新协议

|驱动|驱动名|软件版本|协议版本|
|---|---|---|---|
|c驱动|C DRIVER|c驱动版本    
    
    
|协议版本|
|oci驱动|OCI||协议版本|
|odbc驱动|ODBC||协议版本|
|python驱动|PYTHON DRIVER||协议版本|
|NET驱动|ADO.NET||协议版本|
|Go驱动|GOLANG DRIVER||协议版本|
|yasql|YASQL||c驱动版本|
|exp/imp|EXP_IMP||协议版本|
|ysdldr|YASLDR||协议版本|
|jdbc驱动|YashanDB JDBC Driver|jdbc版本|协议版本|


# 3. 详细测试设计

## 3.1 测试设计方法

对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略。

## 3.2 详细测试设计

当前SR涉及3部分：客户端（yasql、驱动）、协议（lib下的动态链接库）、服务端，每部分有新旧两种版本，共8种组合场景

|序号|客户端|协议|服务端|备注|
|---|---|---|---|---|
|1|新|新|新|√|
|2|新|新|旧|√|
|3|新|旧|新|√|
|4|新|旧|旧|√|
|5|旧|新|新|√|
|6|旧|新|旧|√|
|7|旧|旧|新|√|
|8|旧|旧|旧|×|


  


1）使用不同客户端，验证session视图新增字段正确（新客户端+新包）- 对应序号1

|客户端|预期|补充说明|
|---|---|---|
|yasql|1）  v/dv/gv$session能够观测到对应的字段，且值正确,2）log日志  包含protocal_version,client_version,client_driver|info级别日志|
|c驱动|同上|  
|
|oci驱动|同上|  
|
|odbc驱动|同上|  
|
|exp/imp|同上|  
|
|sqlloader|同上|  
|
|NET驱动|同上|terminal是unknown,调用c#驱动|
|jdbc驱动|同上|terminal是unknown|
|python驱动|同上|terminal是unknown|
|go驱动|同上|terminal是unknown|


2）驱动版本兼容性测试：旧yasdb版本+新驱动 或 新yasdb版本+旧驱动 - 对应序号4、5

|客户端|服务端|预期|
|---|---|---|
|新yasql|旧yasdb|无新增字段，连接不报错|
|新C驱动||无新增字段，连接不报错|
|新OCI||无新增字段，连接不报错|
|新ODBC||无新增字段，连接不报错|
|新exp/imp||无新增字段，连接不报错|
|新  yasldr||无新增字段，连接不报错|
|新NET驱动||无新增字段，连接不报错|
|新jdbc驱动||无新增字段，连接不报错|
|新python驱动||无新增字段，连接不报错|
|新go驱动||无新增字段，连接不报错|
|旧yasql|新yasdb|有7个新增字段，  client_dirver显示为"C DRIVER"，terminal为unknown|
|旧C驱动||有新增字段，  client_dirver显示为"C DRIVER"，terminal为unknown - 测不了？？client driver为null|
|旧OCI||有新增字段，  client_dirver显示为"C DRIVER"，terminal为unknown|
|旧ODBC||有新增字段，  client_dirver显示为"C DRIVER"，terminal为unknown|
|旧exp/imp||有新增字段，  client_dirver显示为"C DRIVER"，terminal为unknown|
|旧  yasldr||有新增字段，  client_dirver显示为"C DRIVER"，terminal为unknown|
|旧NET驱动||有新增字段，  client_dirver显示为"C DRIVER"，terminal为unknown|
|旧jdbc驱动||有新增字段，无  client_dirver字段，  terminal为unknown|
|旧python驱动||有新增字段，  client_dirver显示为"C DRIVER"，terminal为unknown|
|旧go驱动||有新增字段，  client_dirver显示为"C DRIVER"，terminal为unknown|


注：除了java驱动，其他协议都是C驱动（去他驱动依赖于C驱动）

  


3）协议版本兼容性测试：使用两台机器测试，其中客户端和协议位于机器1，服务端位于机器2 - 对应序号2、7

|测试场景|机器1|机器2|预期|
|---|---|---|---|
|旧客户端+旧协议 <-> 新服务端,覆盖上面10种驱动|旧包|新包|有新增字段，但值为空，  CLIENT_PROTOCAL_VERSION，MACHINE，PORT有值（旧协议有这三个字段）,，正常连接|
|新客户端+新协议 <-> 旧服务端,覆盖上面10种驱动|新包|旧包|无新增字段  ，正常连接|


  


4）客户端与服务端版本相同，协议版本不同 - 对应序号3、6

|客户端|协议|服务端|预期|
|---|---|---|---|
|新版本|旧版本|新版本|有新增字段，但值为空，  CLIENT_PROTOCAL_VERSION，MACHINE，PORT有值（旧协议有这三个字段）,，正常连接|
|旧版本|新版本|旧版本|无新增字段，正常连接|


  


## 3.3 DFX测试

|系统级DFX分类|是否涉及|
|:---|:---|
|CT 并发测试|是,视图查询|
|DFR|不涉及，本需求只关注session视图的新增字段，不涉及故障类测试|
|HA|不涉及，关注主节点查询视图有新增字段即可|
|KT kill测试|不涉及，KT已覆盖session视图|
|一致性|不涉及，动态视图不涉及一致性|
|三方测试工具    
  (sqltest，sqlancer)|不涉及，该需求不涉及sql语法层面的新增修改|
|压力|不涉及，视图不涉及压力测试|
|可维护性|不涉及易分析性/易测试性/配置管理/文档等测试|
|安全|不涉及，不涉及用户密码、用户权限等安全性相关因素，所以不涉及安全专项|
|性能|不涉及，本需求只关注基本功能即可|
|长稳|不涉及，长稳主要关注DB故障情况下的故障恢复和多次稳定运行，本需求只关注session视图新增字段，不涉及长稳|
|升级|是，关注升级前后新版本有新增字段，客户端连接后视图对应字段的值正确|


# 4. 测试用例

# 5. 测试框架设计

本次测试使用guider框架，一致性框架、testkill框架和ha框架  实现。

# 6. 测试环境说明

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机、分布式、集群|


## Comments:

|  [](null)  ,2024/09/19会议纪要    
  参会人：施新华、邬建川、罗爽    
  会议纪要：    
  1.分布式连CN查视图，DN字段没有值，直连DN查询有值    
  2.CT并发测试补充视图的并发,Posted by luoshuang at 九月 19, 2024 16:03|
|---|


