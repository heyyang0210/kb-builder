Created by 杜卓林, last modified on 六月 13, 2024

# 1. 概述

***SR***  *：*    [https://pingcode.yasdb.com/pjm/items/6611a918579a3edb84d862ae](https://pingcode.yasdb.com/pjm/items/6611a918579a3edb84d862ae)    *?*    
  *#YDBRD-25908 ICS支持SSL*

*开发设计：*    [【YDBRD-25908】开发设计文档 - 陈俊杰 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=156107560)  

**背景**  ：

**需求描述**  ：     SSL协议支持安全连接和数据加密传输，ICS需要支持SSL，实现数据传输保密性和完整性。

**需求范围**  ： 分布式

  


# 2. 需求分析

## 2.1 功能点分析

SSL(  **Secure Sockets Layer 安全套接层**  )  是为网络通信提供安全及数据完整性的一种安全协议。SSL介于应用层和TCP层之间。应用层数据不再直接传递给传输层，而是传递给SSL层，SSL层对从应用层收到的数据进行加密，并增加自己的SSL头。

![](https://conf.yasdb.com/download/attachments/156110406/image2024-6-5_14-36-25.png?version=1&modificationDate=1717569386000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzA5NTcsImV4cCI6MTc4MjM4MTc1N30.m5vdLHEMVMGrMw9GZcQ-NcqmWZR4e3E4NIW8me2nCbM)

- 配置参数


分布式新增配置参数DIN_SSL_ENABLE，取值['ON', 'OFF']，默认为OFF，设置为ON时DIN会使用SSL协议进行连接和传输

- 设置方式：alter system set DIN_SSL_ENABLE='ON' scope='SPFILE'
- 生效方式：重启生效


*DIN是否开启SSL可根据DV$PARAMETER视图查询，DIN_STAT无需新增字段；*

  


打开SSL需要进行下面的设置

客户端：配置服务端  **根证书**  信息

$YASDB_HOME/client/yasc_env.ini

  `ssl_root_cer= `      `'$YASDB_DATA/CLIENT/SSL/ca.crt'`         `//服务端根证书`  

服务端：配置自身  **证书**  信息

$YASDB_DATA/config/yasdb.ini

  `ssl_enable=on`      
    `ssl_cert_file= $YASDB_DATA/CONFIG/SSL/server.crt `      `//服务端二级证书`      
    `ssl_key_file= $YASDB_DATA/CONFIG/SSL/server.key  `      `//服务端私钥`      
    `ssl_dh_param_file = /$YASDB_DATA/CONFIG/SSL/dhparam.pem `      `//dh参数文件`  

#### 4.3.1 SSL相关文件

保存路径：$YASDB_DATA/config/ssl，需要在每个节点创建该文件夹

|  `[cjj@AchorBase data]$ ll cn-2-1`      `/config/ssl/`      
    `total 28`      
    `-rw-rw-r-- 1 cjj cjj 1099 Jun 11 12:01 ca.crt         `      `//`         `根证书`      
    `-rw-rw-r-- 1 cjj cjj 1704 Jun 11 12:01 ca.key`      
    `-rw-rw-r-- 1 cjj cjj   17 Jun 11 12:01 ca.srl`      
    `-rw-rw-r-- 1 cjj cjj 1500 Jun 11 12:01 dhparam.pem    `      `//`         `DH参数文件`      
    `-rw-rw-r-- 1 cjj cjj  989 Jun 11 12:01 server.crt     `      `//`         `二级证书`      
    `-rw-rw-r-- 1 cjj cjj 3336 Jun 11 12:01 server.csr     `      `//`         `证书签名请求`      
    `-rw-rw-r-- 1 cjj cjj 1704 Jun 11 12:01 server.key     `      `//`         `服务端私钥`  |
|:---|


  


## 证书制作

### 1.创建    `服务端根证书(CA)`  

$ openssl req -new -x509 -days 365 -nodes -out ca.crt -keyout ca.key -subj "/CN=FooCA"

CA证书用于给数据库服务器证书签名，同时需要把CA证书发送给数据库客户端，客户端使用CA证书验证数据库服务器证书。

###   
  2.生成数据库服务器证书签名请求

$ openssl req -new -nodes -text -out server.csr -keyout server.key -subj "/CN=192.168.137.5"

将证书请求文件(包含用户信息)和证书签名分开操作，证书请求文件可重用，因为后面可能需要重新生成签名信息。

  


### 3.使用CA证书对签名请求签名(二级证书)

$ openssl x509 -req -in server.csr -text -days 5 -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt

这里设置有效期为5天，可以观察在服务器证书有效期小于7天的时候，  连接登录后会在日志中产生告警提醒  – 或连接不上？待确认表现

  


### 4.DH参数文件

$   openssl dhparam -2 -out dhparam.pem -text 2048

-  - 单机分布式可只生成一次

  


## 2.2 应用场景

1. 支持SSL连接
1. 支持数据传输加密


  


## 2.3 规格约束

- 新增  DIN_SSL_ENABLE  ，控制    分布式DIN是否开始SSL安全连接和加密传输开关  ，此参数重启生效。
- 节点间参数配置必须一致
- 私钥、二级证书、DH算法三个参数复用CS的配置
- UDS不开启SSL
- 集群和YCS的ICS不支持SSL配置和SSL连接


  


# 3. 详细测试设计

### 3.1 特性关联领域分析：

1. 配置参数：  SSL_CERT_FILE\SSL_KEY_FILE\SSL_DH_PARAM_FILE 三个参数  在参数测试中已覆盖
1. SSL功能：  客户端监听测试，  开启ssl后，节点间是数据传输会加密，不影响已有功能
1. 部署形态：  分布式
1. 性能：开启SSL后，tpch性能不下降（  摸底测试  ），备份恢复性能
1. 扩缩容  ---- 不支持扩缩容
1. 可靠性、异常场景


### 3.2 测试设计：

主要采用  场景法和错误推测法进行设计

[YDBRD-25908 ICS支持SSL测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMmVhMWFkOWEzMzExZGM5NThmIiwicmVmX2lkIjoiNjczOTZlMmQ3MjgyMDZlZmI5MmYyNmE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcwOTU2LCJleHAiOjE3ODI0NTczNTZ9.4GX6_9UeXdv9b_n2Cjbd60TjAfoDMvlO6HyLUhQfBD8)

![](https://pingcode.yasdb.com/atlas/files/public/67396e2ea1ad9a3311dc9591/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzA5NTcsImV4cCI6MTc4MjM4MTc1N30.m5vdLHEMVMGrMw9GZcQ-NcqmWZR4e3E4NIW8me2nCbM)

  


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|/|
|KT|/|
|长稳|/|
|一致性|/|
|三方测试工具    
  (sqltest，sqlancer)|/|
|安全|是|
|DFR|/|
|HA|/|
|压力|是|
|性能|是|
|可维护性|/|
|兼容性|/|
|分布式|是|
|升级|/|


# 4. 测试用例

详见附件

# 5. 测试框架设计

# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

## Attachments:

[image2024-6-11_19-59-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMmU4OTcwYzJhZjRmNTIxNzFkIiwicmVmX2lkIjoiNjczOTZlMmQ3MjgyMDZlZmI5MmYyNmE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcwOTU2LCJleHAiOjE3ODI0NTczNTZ9.WCb9p3BsF59gzfh2xxl_viER4JlT5OpNmfRpdDq3lMo)

 (image/png)    


[YDBRD-25908 ICS支持SSL测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMmVhMWFkOWEzMzExZGM5NThmIiwicmVmX2lkIjoiNjczOTZlMmQ3MjgyMDZlZmI5MmYyNmE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcwOTU2LCJleHAiOjE3ODI0NTczNTZ9.4GX6_9UeXdv9b_n2Cjbd60TjAfoDMvlO6HyLUhQfBD8)

 (application/x-xmind)    


[image2024-6-13_9-31-18.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMmVhMWFkOWEzMzExZGM5NTkwIiwicmVmX2lkIjoiNjczOTZlMmQ3MjgyMDZlZmI5MmYyNmE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcwOTU2LCJleHAiOjE3ODI0NTczNTZ9.o7_Q03NSj0CKg0jOAv_U2KRwjOZ8S9SWhvcgssl2vkE)

 (image/png)    


## Comments:

|  [](null)  ,会议纪要：    
  与会人：施新华、陈俊杰、杜卓林    
  会议时间：2024/6/13 11:00-11:30    
  会议地点：线上会议    
  纪要信息：    
  1、SSL开关打开后，配置证书的路径为相对路径、绝对路径情况下的表现，预期一之前SSL需求一致，无影响     
  2、SSL开关关闭，不影响yasql连接，会想想集群中各节点的连接    
  3、SSL开关打开，不配置其余参数，此时会检查参数报错    
  4、重复配置单一节点的SSL相关证书，目前单机上没有影响，但多机待测    
  5、DIN_SSL_ENABLE和HA_SSL_ENABLE、SSL_ENABLE 三个参数理论不相互影响，待确认最终表现    
  6、目前单机分布式可进行扩缩容，与理论相悖；多机分布式暂不支持扩缩容，需与yasboot确认是否在SSL开关打开时对扩缩容进行校验，拦截扩缩容操作    
  7、单机、集群部署模式下，打开参数应无影响,Posted by duzhuolin at 六月 13, 2024 11:42|
|---|
