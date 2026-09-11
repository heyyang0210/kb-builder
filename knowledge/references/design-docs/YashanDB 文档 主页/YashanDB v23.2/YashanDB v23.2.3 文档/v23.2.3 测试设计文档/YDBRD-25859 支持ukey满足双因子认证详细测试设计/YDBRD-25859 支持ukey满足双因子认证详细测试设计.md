Created by 李世铭, last modified on 九月 05, 2024

# 1. 概述

为满足国密要求，需对密码认证方式的传输流程进行以下改造，OS免密不需要改造：

- 口令登录满足GB15843第二部分标准，支持对称加解密：    [GB T 15843.2-2017 信息技术　安全技术　实体鉴别　第2部分：采用对称加密算法的机制 - 道客巴巴 (doc88.com)](https://www.doc88.com/p-2826482869729.html)  
- UKEY登录满足GB15843第三部分标准，支持签名验签：    [GB-T 15843.3-2023信息技术 安全技术 实体鉴别 第3部分：采用数字签名技术的机制 - 道客巴巴 (doc88.com)](https://www.doc88.com/p-70859854920255.html)  


# 2. 需求分析

SR：    [https://pingcode.yasdb.com/pjm/items/6611a89a579a3edb84d86066](https://pingcode.yasdb.com/pjm/items/6611a89a579a3edb84d86066)    ?    
  #YDBRD-25859 【安全】支持ukey满足双因子认证

设计文档：    [C驱动支持UKEY满足双因子认证](150603854.html)  

## 2.1 功能点分析

- 口令登录支持SM4加密


判断客户端版本，高版本使用sm4替换之前的AES加密，兼容低版本保留AES加密

- 支持使用ukey验签


使用sm2算法进行ukey验签

新增url连接参数UKEY_NAME UKEY_PIN，用于输入ukey的设备名和用户密码，用于ukey的登录。yasql例如yasql sys/Cod-2022@  "  192.168.10.31:1688  ?  UKEY_NAME=DBA&UKEY_PIN=12345678  "

yasboot工具需要om组做适配，后面转测（与这个SR一起上车）

新增数据库参数UKEY_DBA_PUBLIC_KEY_FILE UKEY_SECURITY_ADMIN_PUBLIC_KEY_FILE UKEY_AUDIT_ADMIN_PUBLIC_KEY_FILE三个参数来配置三种角色对应的公钥文件

- yaspwd工具支持导出公钥


命令：yaspwd ukey_role=DBA  ukey_role只能取 DBA SECURITY_ADMIN AUDIT_ADMIN 分别代表DBA角色安全管理员和审计员三种角色

通过工具yaspwd将ukey中的公钥导出并保存在单独的文件中本地保存。

1.修改设备名称

2.创建或打开YashanDB app

打开名称为YashanDB的app，如果没有则提示用户输入设备认证码，设置admin的密码，用户密码，创建名称为YashanDB的app，并打开app

如果已经存在YashanDB的app，在打开app后提示用户输入用户密码，验证登录用户

- 协议兼容性


**ackLogin改动：**

transEncryVersion：

SYM_ENCRY_VERSION_AES = 1,    
  SYM_ENCRY_VERSION_PLAIN = 2,    
  SYM_ENCRY_VERSION_SM4_CBC = 3,    
  SYM_ENCRY_VERSION_SM4_SM2 = 4,

新增类型

SYM_ENCRY_VERSION_SM4_CBC = 3

SYM_ENCRY_VERSION_SM4_SM2 = 4

新增数据库参数

PASSWORD_CRYPTO_METHOD ：控制数据库登录密码的加密方式，可选值AES，SM4_CBC，默认值AES

CLIENT_UKEY_AUTH：控制数据库登录是否使用ukey，可选值TRUE，FALSE。默认FALSE。

校验逻辑：

1. 如果配置AES，SM4_CBC但是没有加载openssl库则启动失败
1. 如果不是AES，SM4_CBC，PLAIN这三个值则数据库启动失败
1. PASSWORD_CRYPTO_METHOD 值AES，SM4_CBC，PLAIN，分别对应transEncryVersion值的SYM_ENCRY_VERSION_AES ，SYM_ENCRY_VERSION_SM4_CBC ， SYM_ENCRY_VERSION_PLAIN 
1. 如果transEncryVersion为SYM_ENCRY_VERSION_SM4_CBC 但是  **客户端版本为低版本则transEncryVersion降级为SYM_ENCRY_VERSION_AES 为了保证低版本的客户端能登录上**
1. 如果transEncryVersion为SYM_ENCRY_VERSION_SM4_CBC并且CLIENT_UKEY_AUTH配置为TRUE则登录需要ukey，则transEncryVersion升级为SYM_ENCRY_VERSION_SM4_SM2 


## 2.2 应用场景

传输加密和口令验签环节需要符合国标

## 2.3 约束

无

# 3. 详细测试设计

## 3.1 测试设计方法

参数检查——边界值，等价类

功能验证——场景组合

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|否|
|KT|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|是|
|DFR|否|
|HA|是|
|压力|否|
|性能|否|
|可维护性|否|


**参数验证**

|测试项|参数|测试点|  
|
|:---|:---|:---|:---|
|yaspwd|ukey_role|取值范围|[dba, security_admin, audit_admin]，超过取值范围报错|
|  
|  
|是否区分大小写|参数名，参数值|
|yasdb|PASSWORD_CRYPTO_METHOD|取值范围|[AES，SM4_CBC，PLAIN]，超过取值范围报错|
|  
|  
|默认值|AES|
|  
|  
|生效范围|  
|
|  
|CLIENT_UKEY_AUTH|取值范围|[TRUE，FALSE]|
|  
|  
|默认值|FALSE|
|  
|  
|生效范围|  
|
|  
|UKEY_DBA_PUBLIC_KEY_FILE|默认值|$YASDB_DATA/instance/public_key_dba.pem|
|  
|  
|生效范围|  
|
|  
|UKEY_SECURITY_ADMIN_PUBLIC_KEY_FILE|默认值|$YASDB_DATA/instance/public_key_security_admin.pem|
|  
|  
|生效范围|  
|
|  
|UKEY_AUDIT_ADMIN_PUBLIC_KEY_FILE|默认值|$YASDB_DATA/instance/public_key_audit_admin.pem|
|  
|  
|生效范围|  
|
|url连接参数|UKEY_NAME|取值范围|[dba, security_admin, audit_admin]，超过取值范围报错|
|  
|  
|是否区分大小写|  
|
|  
|UKEY_PIN|是否区分大小写|  
|


**场景组合**

|测试项|测试点||  
|  
|
|:---|:---|---|:---|:---|
|口令加密|PASSWORD_CRYPTO_METHOD设置为SM4_CBC||可以登录且使用SM4加密|  
|
|  
|PASSWORD_CRYPTO_METHOD设置为AES||可以登录且使用AES加密|  
|
|  
|PASSWORD_CRYPTO_METHOD设置为PLAIN||可以登录且不加密|  
|
|ukey验签|PASSWORD_CRYPTO_METHOD设置为AES或PLAIN，  CLIENT_UKEY_AUTH设置为TRUE||起库报错|  
|
|  
|服务端打开ukey开关，连接普通用户||可以登录|  
|
|  
|服务端打开ukey开关，不带url参数登录  SECURITY_ADMIN，AUDIT_ADMIN，DBA用户||登录失败|  
|
|  
|服务端打开ukey开关，url参数填写正确连接  SECURITY_ADMIN，AUDIT_ADMIN，DBA用户||登录成功|冒烟|
|  
|服务端打开ukey开关，url参数填写错误密码后连接,SECURITY_ADMIN，AUDIT_ADMIN，DBA用户||登录失败|  
|
|  
|插入多个不同名ukey，url参数填写正确连接  SECURITY_ADMIN，AUDIT_ADMIN，DBA用户||登录成功|  
|
|  
|插入多个ukey，其中有同名ukey，填写同名的用户名登录  SECURITY_ADMIN，AUDIT_ADMIN，DBA用户||登录失败|  
|
|  
|ukey重新生成密钥对后，服务端使用旧的公钥文件，url填写正确的参数连接  SECURITY_ADMIN，AUDIT_ADMIN，DBA用户||登录失败|  
|
|  
|服务端关闭ukey开关，登录带url参数||url参数不起作用|  
|
|yaspwd生成公钥|检查生成的公钥文件权限||需要限制用户的修改权限|冒烟|
|  
|插入多个ukey导出公钥||报错|  
|
|  
|已经导出过公钥的ukey重新导出公钥||输入用户密码后可以重新生成密钥对，但是不能修改用户密码|  
|
|os免密|服务器所在机器，用户已添加YASDBA组||可以免密免ukey登录|  
|
|  
|服务器所在机器，用户未添加YASDBA组||不可以免密免ukey登录|  
|
|  
|非服务器所在机器，用户已添加YASDBA组||不可以免密免ukey登录|  
|
|兼容性|新服务端，旧客户端|PASSWORD_CRYPTO_METHOD设置为SM4_CBC|可以登录且降级为AES加密|  
|
|  
|  
|PASSWORD_CRYPTO_METHOD设置为AES|可以登录且使用AES加密|  
|
|  
|  
|PASSWORD_CRYPTO_METHOD设置为PLAIN|可以登录且不加密|  
|
|  
|客户端不加载SSL库|PASSWORD_CRYPTO_METHOD设置为SM4_CBC或AES|报错|  
|
|  
|  
|PASSWORD_CRYPTO_METHOD设置为PLAIN|可以登录|  
|
|  
|客户端和服务端不加载ssl库|PASSWORD_CRYPTO_METHOD设置为SM4_CBC或AES|起库报错|  
|
|  
|  
|PASSWORD_CRYPTO_METHOD设置为PLAIN，_CRYPTO_ENABLED设置为FALSE|可以起库成功，可以通过不加密方式登录|  
|


**部署形态**

|形态|规模|
|:---|:---|
|单机|一主二备|
|集群|三实例|
|分布式|3mn3cn3-3dn|


# 4. 测试用例

  


|用例编号|用例测试点|预期|结果|
|---|---|---|---|
|test_sdv_YDBRD_25859_001|检查PASSWORD_CRYPTO_METHOD取值范围|[AES，SM4，PLAIN]，超过取值范围报错|通过|
||检查PASSWORD_CRYPTO_METHOD默认值|AES|通过|
||检查PASSWORD_CRYPTO_METHOD生效范围|spfile|通过|
|test_sdv_YDBRD_25859_002    
    
|检查CLIENT_UKEY_AUTH取值范围|[TRUE，FALSE]|通过|
||检查CLIENT_UKEY_AUTH默认值|FALSE|通过|
||检查CLIENT_UKEY_AUTH生效范围|spfile|通过|
|test_sdv_YDBRD_25859_003    
    
    
    
    
|检查UKEY_DBA_PUBLIC_KEY_FILE默认值|?/instance/public_key_dba.pem|通过|
||检查UKEY_DBA_PUBLIC_KEY_FILE生效范围|spfile|通过|
||检查UKEY_SECURITY_ADMIN_PUBLIC_KEY_FILE默认值|?/instance/public_key_security_admin.pem|通过|
||检查UKEY_SECURITY_ADMIN_PUBLIC_KEY_FILE生效范围|spfile|通过|
||检查UKEY_AUDIT_ADMIN_PUBLIC_KEY_FILE默认值|?/instance/public_key_audit_admin.pem|通过|
||检查UKEY_AUDIT_ADMIN_PUBLIC_KEY_FILE生效范围|spfile|通过|
|test_sdv_YDBRD_25859_004|PASSWORD_CRYPTO_METHOD设置为SM4|可以登录且使用  SM4  加密|通过|
||PASSWORD_CRYPTO_METHOD设置为AES|可以登录且使用  AES  加密|通过|
|test_sdv_YDBRD_25859_005|服务端打开  ukey  开关，不带  url  参数登录  SECURITY_ADMIN  ，  AUDIT_ADMIN  ，  DBA  用户|登录失败|通过|
|test_sdv_YDBRD_25859_006|服务端打开ukey开关，连接普通用户|登录成功|通过|
|test_sdv_YDBRD_25859_007|服务端打开  ukey  开关，  url  参数填写正确连接  SECURITY_ADMIN  ，  AUDIT_ADMIN  ，  DBA  用户|登录成功|通过|
|test_sdv_YDBRD_25859_008|服务端打开  ukey  开关，  url  参数填写错误密码后连接,SECURITY_ADMIN，  AUDIT_ADMIN  ，  DBA  用户|登录失败|通过|
|test_sdv_YDBRD_25859_009|ukey重新生成密钥对后，服务端使用旧的公钥文件，  url  填写正确的参数连接  SECURITY_ADMIN  ，  AUDIT_ADMIN  ，  DBA  用户|登录失败|通过|
|test_sdv_YDBRD_25859_010|服务端关闭  ukey  开关，登录带  url  参数|url参数不起作用，登录成功|通过|


# 5. 测试框架设计

install_test测试框架，需要根据需求补充功能

# 6. 测试环境说明

|IP|内存|磁盘空间|磁盘类型|CPU|操作系统|
|:---|:---|:---|:---|:---|:---|
|192.168.3.198|32G|700G|SSD|8核|centos7.0|
|192.168.3.140|32G|900G|SSD|8核|centos7.0|


# 7. 工作量评估

工作量：4  *人天*

计划测试完成时间：5/16

## Attachments:

[YDBRD-25859 支持ukey满足双因子认证详文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZjZhMWFkOWEzMzExZGM4ZGU2IiwicmVmX2lkIjoiNjczOTZjZjY1OTNmOTljOWZmMjM3NWQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0OTc5LCJleHAiOjE3ODIzOTEzNzl9.f99zEdKSKazrhxoVr01dW6tJ4rAzhCKD5vCnZ7Wg8-g)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,会议纪要,会议时间：2024/4/22,参与人：冯皓博、侯忠林、贺国锋、施新华、李世铭,1.新增配置参数用于控制口令加密算法是否使用sm4算法，增加sm4加密算法和sha256口令摘要算法的兼容测试,2.需要验证内部是否确实使用sm2和sm4加密算法,Posted by lishiming at 四月 22, 2024 15:12|
|---|
|  [](null)  ,会议纪要,会议时间：2024/5/13,参与人：冯皓博、侯忠林、史鑫、李世铭,1.调研友商ukey使用方法（url登录参数，yaspwd导出公钥功能）,2.  检查使用ukey管理工具导出的公钥是否可用（是否yaspwd导出公钥一致）,3.  PASSWORD_CRYPTO_METHOD只支持AES和SM4_CBC（去掉PLAIN方式）,4.增加windows平台和arm平台测试验证,5.asan包测试服务端shutdown或客户端exit是否有内存泄漏,6.增加url参数与ukey交叉测试,7.  手动微调公钥文件，检查是否还能验证成功,8.手动拦包微调签名数据，检查是否还能验证成功,9.所有参数输入项增加非法值检查,10.管理权限角色登录后是否可以被其他用户删除,11.使用旧版本客户端可以绕过ukey？（目前可以绕过ukey，需要开发后续确认规格）,Posted by lishiming at 五月 13, 2024 16:54|
