Created by 刘晓旋, last modified on 十月 09, 2024

# 1. 概述

IR:    [YDBRD-24660](https://jira.yasdb.com/browse/YDBRD-24660?src=confmacro)    -  通信加密算法兼容TLCP和TLS  开发中

支持  GMTLS（也叫 TLCP）  国密协议。TLS/TLCP 两者主要有以下区别

|区别|国标TLCP|国际TLS|细节|
|:---|:---|:---|:---|
|  
|1） 协议的版本号不同，握手和加密协议细节不同；|  
|  
|
|  
|2） 算法不同,SM2(  公钥密码算法),SM3(  密码摘要算法  ),SM4(  分组密码算法  ))|TLS采用的国际密码算,RSA,DES,SHA|SM2 -- RSA,SM3 --  DES,SM4 – SHA|
|  
|3） 采用的是SM2双证书体系。,CA,CA–加密证书 用于会话密钥生成,CA–签名证书 用于身份验证。（私钥加密，公钥解密）|一个证书参与到 身份验证和主会话密钥的生成|  
|


# 2. 需求分析

## 2.1 功能点分析

支持范围：

- HA 内部链路间
    - 主备
- C/S
    - **C驱动/yashan**


## 2.2 应用场景

### 双证书制作

|  `gmssl sm2keygen -pass 1234 -out rootcakey.pem`      
    `gmssl certgen -C CN -ST Beijing -L Haidian -O PKU -OU CS -CN ROOTCA -days 3650 -key rootcakey.pem -pass 1234 -out rootcacert.pem -key_usage keyCertSign -key_usage cRLSign -ca`      
    `gmssl certparse -in rootcacert.pem`      
    
    `--服务端`      
    `gmssl sm2keygen -pass 1234 -out cakey.pem`      
    `gmssl reqgen -C CN -ST Beijing -L Haidian -O PKU -OU CS -CN `      `"Sub CA"`         `-key cakey.pem -pass 1234 -out careq.pem`      
    `gmssl reqsign -in careq.pem -days 365 -key_usage keyCertSign -path_len_constraint 0 -cacert rootcacert.pem -key rootcakey.pem -pass 1234 -out cacert.pem -ca`      
    `gmssl certparse -in cacert.pem`      
    
    `gmssl sm2keygen -pass 1234 -out signkey.pem`      
    `gmssl reqgen -C CN -ST Beijing -L Haidian -O PKU -OU CS -CN localhost -key signkey.pem -pass 1234 -out signreq.pem`      
    `gmssl reqsign -in signreq.pem -days 365 -key_usage digitalSignature -cacert cacert.pem -key cakey.pem -pass 1234 -out signcert.pem`      
    `gmssl certparse -in signcert.pem`      
    
    `gmssl sm2keygen -pass 1234 -out enckey.pem`      
    `gmssl reqgen -C CN -ST Beijing -L Haidian -O PKU -OU CS -CN localhost -key enckey.pem -pass 1234 -out encreq.pem`      
    `gmssl reqsign -in encreq.pem -days 365 -key_usage keyEncipherment -cacert cacert.pem -key cakey.pem -pass 1234 -out enccert.pem`      
    `gmssl certparse -in enccert.pem`      
    
    `cat signcert.pem > double_certs.pem`      
    `cat enccert.pem >> double_certs.pem`      
    `cat cacert.pem >> double_certs.pem`      
    
    `--客户端`      
    `gmssl sm2keygen -pass 1234 -out clientkey.pem`      
    `gmssl reqgen -C CN -ST Beijing -L Haidian -O PKU -OU CS -CN Client -key clientkey.pem -pass 1234 -out clientreq.pem`      
    `gmssl reqsign -in clientreq.pem -days 365 -key_usage digitalSignature -cacert cacert.pem -key cakey.pem -pass 1234 -out clientcert.pem`      
    `gmssl certparse -in clientcert.pem`  |
|:---|


### 配置

（1）服务端

|  `ssl_enable = on`      
    `ENCRYPT_TYPE = tlcp`      
    `TLCP_CERT_FILE = D:\anchorhome\TLCP\double_certs.pem`      
    `TLCP_SIGNKEY_FILE = D:\anchorhome\TLCP\signkey.pem`      
    `TLCP_ENCKEY_FILE = D:\anchorhome\TLCP\enckey.pem`      
    `TLCP_CACERT_FILE = D:\anchorhome\TLCP\cacert.pem`      
    `TLCP_PASS_FILE = D:\anchorhome\TLCP\tlcpPass`  |
|:---|


tlcpPass文件：D:\anchorhome\TLCP\tlcpPass

|  `TLCP_ENC_PASS = 1234`      
    `TLCP_SIGN_PASS = 1234`  |
|:---|


（2）客户端：$YASDB_HOME/client/yasc_env.ini

|  `TLCP_CACERT_FILE=D:\anchorhome\TLCP\rootcacert.pem`      
    `TLCP_CERT_FILE=D:\anchorhome\TLCP\clientcert.pem`      
    `TLCP_CLIENT_KEY_FILE=D:\anchorhome\TLCP\clientkey.pem`      
    `TLCP_CLIENT_KEY_PASS = 1234`  |
|:---|


## 2.3 规格约束

- 不支持 JDBC/yashan 驱动
- HA主备不支持 TLCP


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：配置参数变量值–边界值；等价类*

*场景法覆盖*

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用 xmind 的方式*
    1. *配置参数测试*
    1. 互信功能测试
    1. 版本兼容性测试
    1. HA传输测试
    1. 多连接并发测试
    1. c驱动测试
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*    



|测试场景|测试项|等价类|备注|
|---|---|---|---|
|配置参数    
    
    
    
    
    
    
    
    
    
    
    
|ssl_enable|on,off,其他值,空|1、需要测试 scope=memory、spfile,2、测试 alter session (预期失败),  
    
    
    
    
    
    
    
    
    
    
    
|
||ENCRYPT_TYPE|tlcp,ssl,其他值,空||
||TLCP_CERT_FILE|合法路径：覆盖英文目录、中文目录、多层重复命名嵌套的目录（覆盖路径存在、路径不存在）,非法路径（相对路径）,空||
||TLCP_SIGNKEY_FILE|合法路径（覆盖路径存在、路径不存在）,非法路径（相对路径）,空||
||TLCP_ENCKEY_FILE|合法路径（覆盖路径存在、路径不存在）,非法路径（相对路径）,空||
||TLCP_CACERT_FILE|合法路径（覆盖路径存在、路径不存在）,非法路径（相对路径）,空||
||TLCP_PASS_FILE|合法路径（覆盖路径存在、路径不存在）,非法路径（相对路径）,空||
||TLCP_ENC_PASS|密钥正确,密钥错误||
||TLCP_SIGN_PASS|密钥正确,密钥错误||
||TLCP_CLIENT_KEY_FILE|合法路径（覆盖路径存在、路径不存在）,非法路径（相对路径）,空||
||TLCP_CLIENT_KEY_PASS|密钥正确（密码长度、密码复杂度、密码包含中英文特殊字符（？））,密钥错误||
|互信功能测试,  
    
    
    
|开启 ssl_enable|不配置任何证书路径|认证失败|
||  
|服务端只配置部分证书路径|认证失败|
||  
|服务端配置所有证书路径， 客户端未配置|认证失败|
||  
|服务端未配置证书路径， 客户端已配置|认证失败|
||  
|服务端和客户端配置所有证书路径，且证书有效|认证成功|
||  
|服务端证书失效|认证失败|
||  
|客户端证书失效|认证失败|
||  
|服务端证书失效后，重新生成证书|认证成功|
||  
|客户端证书失效后，重新生成证书|认证成功|
||  
|设置 ENCRYPT_TYPE=ssl，服务端和客户端配置 TLCP 证书路径|认证失败|
||关闭 ssl_enable|覆盖以上场景|不走加密传输|
||同时配置 TLCP、SSL 证书路径，  ENCRYPT_TYPE 覆盖：TLCP、SSL|客户端发起登录,执行业务操作|走的加密链路正确|
|版本兼容性测试    
    
    
|客户端是低版本，服务端高版本|服务端配置 SSL|SSL认证成功|
||  
|服务端配置 TLCP|TLCP 认证失败，报错协议不兼容|
||客户端是高版本，服务端是低版本|服务端配置 SSL|SSL认证成功|
||  
|服务端配置TLCP（不需要测试？）|不支持配置TLCP参数|
|HA传输测试,  
    
    
    
    
|主备服务端都开启了 TLCP 加密（HA_SSL_ENABLE=ON）|主备客户端配置了证书（主备在同一台主机、跨主机）,主备客户端未配置证书（主备在同一台主机、跨主机）,主或者备其一没有配置客户端证书（主备在同一台主机、跨主机） |HA主备不支持TLCP链路，业务执行失败,（如果使用 yasboot 部署会不成功）,  
|
||主配置了 TLCP 加密，备没有配置 TLCP 加密（HA_SSL_ENABLE=ON）|主客户端配置了证书,主客户端未配置证书|  
|
||主未配置 TLCP 加密，备配置了 TLCP 加密（HA_SSL_ENABLE=ON）|主客户端配置了证书,主客户端未配置证书|  
|
||主备服务端都配置了 TLCP 加密，HA_SSL_ENABLE=OFF|  
|HA功能正常|
||切主|切主后，主备服务端都开启了 TLCP 加密，切主|  
|
|多连接并发测试|客户端和服务端都配置 TLCP 加密|客户端同时启用多个连接，并同时释放多个连接|观察服务端是否异常|
||大数据量的查询操作|发起多个并发大数据量查询操作||
|c驱动测试|服务端开启 TLCP 加密|c驱动端配置 TLCP 证书,c驱动端未配置 TLCP 证书|  
|
|  
|服务端未开启 TLCP 加密|c驱动端配置 TLCP 证书,c驱动端未配置 TLCP 证书|  
|
|jdbc 驱动|服务端开启 TLCP 加密|jdbc驱动端配置 TLCP 证书|jdbc连接失败|


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|否|
|KT|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|  
|
|DFR|  
|
|HA|  
|
|压力|  
|
|性能|  
|
|可维护性|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件 

[TLCP 冒烟文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMGZhMWFkOWEzMzExZGM4ZTdlIiwicmVmX2lkIjoiNjczOTZkMGU1OTNmOTljOWZmMjM3NzUzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NjE3LCJleHAiOjE3ODIzOTIwMTd9.gS9f5JvgFuVmKvOXd-jDa7FTfMiSdNiph4TdThwDig0)

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机 集群|


# 7. 工作量评估

工作量：7  *人天*

计划测试完成时间：

## Attachments:

[TLCP 冒烟文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMGZhMWFkOWEzMzExZGM4ZTdlIiwicmVmX2lkIjoiNjczOTZkMGU1OTNmOTljOWZmMjM3NzUzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NjE3LCJleHAiOjE3ODIzOTIwMTd9.gS9f5JvgFuVmKvOXd-jDa7FTfMiSdNiph4TdThwDig0)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,会议纪要：,与会人：史鑫，程康，冯浩博，胡晓畔，周彬鑫，刘晓旋    
  会议时间：2024-4-16 17：30 ~ 18：30    
  腾讯会议：441 506 693    
  纪要信息：,1、HA 场景主备的内部通信是不支持 TLCP 链路的，需要开发确认一下主备均配置了 TLCP 后业务操作（如DDL）的表现如何    
  2、HA 场景主备配置了 TLCP 后，如果 listen_addr = replication_addr 时起库直接拦截，listen_addr != replication_addr 起库成功，主备同步正常    
  3、分布式场景可以简单覆盖一下 C/S 端,评审通过与否：通过,Posted by liuxiaoxuan at 四月 16, 2024 19:15|
|---|
