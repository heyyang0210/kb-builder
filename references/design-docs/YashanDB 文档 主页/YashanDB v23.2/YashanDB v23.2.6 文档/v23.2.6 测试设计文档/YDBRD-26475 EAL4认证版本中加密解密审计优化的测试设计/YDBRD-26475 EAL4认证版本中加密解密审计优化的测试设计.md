Created by 罗爽, last modified on 九月 10, 2024

# **1. 概述**

本文描述EAL4认证版本中加密解密审计优化的测试设计。

# **2. 需求分析**

SR：    [https://pingcode.yasdb.com/pjm/items/661fa075fd997db58adbc972](https://pingcode.yasdb.com/pjm/items/661fa075fd997db58adbc972)    ?    
  #YDBRD-26475 EAL4认证版本中加密解密审计优化

开发设计文档：    [EAL4认证版本中加密解密审计优化](https://conf.yasdb.com/pages/viewpage.action?pageId=159433899)  

## 2.1 功能分析

1）当前需求新增三个行为审计项：

|审计模块|审计项|被审计的操作|
|---|---|---|
|基础算法|BASE ENCRYPT|BASE_ENCRYPT|
|  
|  
|BASE_DECRYPT|
|  
|  
|BASE_CREATE_KEY|
|透明表空间|TDE ENCRYPT|TDE_CREATE_KEY|
|  
|  
|TDE_DESTORY_KEY|
|链路|LINK ENCRYPT|LINK_CREATE_KEY|
|  
|  
|LINK_ENCRYPT|
|  
|  
|LINK_DECRYPT|
|  
|  
|LINK_DESTORY_KEY|


其中被审计的操作可在unified_audit_trail的OBJECT_NAME字段中查看：  (TYPE=(BASE_DECRYPT));(ALGORITHM=(AES))

2）不涉及权限审计和角色审计

## 2.2 相关视图

AUDITABLE_SYSTEM_ACTIONS  –  显示所有的系统审计项

## 2.3 规格约束

- 基础算法和链路的审计为异步审计


# **3**     **测试设计方法**   

## 3.1 测试设计方法

本次测试主要采用场景法、正交组合法、等价类进行测试。

## 3.2 详细测试设计

1）针对上述审计项，具体的测试场景如下：

|审计项|审计操作|触发场景|场景业务描述|补充说明|
|---|---|---|---|---|
|BASE ENCRYPT|BASE_ENCRYPT|基础算法加密|authEncryDigestBySalt：客户端使用，服务端暂无场景   ,authEncryDigest：create user xxx identified by xxx,encrEncrypt：透明加密表空间创建|加密算法可指定为'ASE128'或'SM4'|
|  
|BASE_DECRYPT|基础算法解密|authVerifyDigest：密码登录场景，密码校验,authSymDecryDigest：密码登录场景，密码校验,encrDecrypt：透明加密表空间销毁|  
|
|  
|BASE_CREATE_KEY|基础算法创建key|authSymGenKey：密码登录场景，密码校验,authSymEncryDigest：密码登录场景，密码校验|  
|
|TDE ENCRYPT|TDE_CREATE_KEY|创建透明加密表空间|create tablespace tps_Encryption_sm4 datafile 'tps_Encryption_sm4' size 32M autoextend on next 64M maxsize unlimited    
  encryption using 'SM4' encrypt;,create tablespace tps_Encryption_aes datafile     'tps_Encryption_aes' size 32M autoextend on next 64M maxsize unlimited    
  encryption using 'AES128' encrypt;|加密算法可指定为'ASE128'或'SM4'|
|  
|TDE_DESTORY_KEY|销毁  透明加密表空间|drop   tablespace tps_Encryption_sm4;|加密算法可指定为'ASE128'或'SM4'|
|LINK ENCRYPT|LINK_CREATE_KEY|开启SSL、TLCP后Accept|创建session连接|需要先配置SSL、TLCP连接|
|  
|LINK_ENCRYPT|开启SSL、TLCP后链路 write|执行sql操作，可能有多条审计记录|同上|
|  
|LINK_DECRYPT|开启SSL、TLCP后链路 read|执行sql操作，可能有多条审计记录|同上|
|  
|LINK_DESTORY_KEY|开启SSL、TLCP后disconnect|断开session连接|同上|


2）测试shared模式下的加解密审计

YashanDB默认为专有模式，单机/集群配置共享线程池模式的方法为：

配置MAX_WORKERS < MAX_SESSIONS 且 MAX_REACTOR_CHANNELS >=1

测试观察点：共享模式下上述功能测试场景没问题，审计记录正常

## 3.3 DFX测试

|系统级DFX分类|是否涉及|补充说明|
|:---|:---|---|
|CT 并发测试|是|  
|
|DFR|/|  
|
|HA|是|最大保护模式下，全部备节点故障，验证：1）登录不卡；2）主节点的其他ddl操作，前5min会卡住，5min后报错|
|KT kill测试|是|  
|
|一致性|/|  
|
|三方测试工具    
  (sqltest，sqlancer)|/|  
|
|压力|/|  
|
|可维护性|/|  
|
|安全|/|  
|
|性能|/|  
|
|长稳|/|  
|


# **4 测试用例**

# **5 测试框架设计**

本次测试使用guider框架，一致性框架、testkill框架和ha框架  实现。

# **6 测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机、集群|


## Comments:

|  [](null)  ,会议纪要：    
  会议时间：2024/09/10 15:00-15:30    
  参会人员: 冯皓博，王林，施新华，罗爽    
  评审意见及改进：    
  1、配置SSL、TLCP连接后，观察AUTHENTICATION_TYPE字段中的protocol    
  2、主备关注最大保护模式下，全部备节点故障，验证：1）登录不卡；2）主节点的其他ddl操作卡住,Posted by luoshuang at 九月 20, 2024 09:25|
|---|
