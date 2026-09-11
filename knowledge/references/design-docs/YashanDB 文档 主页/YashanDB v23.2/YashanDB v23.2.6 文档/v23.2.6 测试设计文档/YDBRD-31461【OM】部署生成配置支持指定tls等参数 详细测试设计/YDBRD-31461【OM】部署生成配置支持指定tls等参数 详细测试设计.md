Created by 陈钦卿, last modified on 十月 09, 2024

# 1. 概述

SR：    [https://pingcode.yasdb.com/pjm/items/66bad2548f5ee191734d0045](https://pingcode.yasdb.com/pjm/items/66bad2548f5ee191734d0045)    ? #YDBRD-31461 【OM】部署生成配置支持指定tls等参数

开发设计：    [OM支持部署生成配置指定tls等参数方案设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=167158544#--ssl-path)  

交付形态：单机、分布式、集群

交付版本：23.2

# 2. 需求分析

## 2.1 功能点分析

1、生成配置命令新增  协议  参数

- **--ssl-protocol**  ：只支持ssl
- **--ssl-path**  ：ssl认证秘钥所在的路径
- 主机部署配置文件（  **hosts.toml**  ）变动：增加参数  **SSL_CERT_FILE、SSL_DH_PARAM_FILE、SSL_KEY_FILE、SSL_ROOT_CER**
- 拷贝证书
- 数据库部署文件变动（node.config下新增ssl相关配置）：增加参数  **SSL_CERT_FILE、SSL_DH_PARAM_FILE、SSL_KEY_FILE、SSL_ENABLE**


```
[ssl]
  SSL_CERT_FILE = "/home/wolf/anchorbase/work/ssl/server.crt"
  SSL_DH_PARAM_FILE = "/home/wolf/anchorbase/work/ssl/dhparam.pem"
  SSL_KEY_FILE = "/home/wolf/anchorbase/work/ssl/server.key"
  SSL_ROOT_CER = "/home/wolf/anchorbase/work/ssl/root.crt"
```

```
[group.node.config]
      CGROUP_ROOT_DIR = "/sys/fs/cgroup"
      LISTEN_ADDR = "192.168.4.110:1688"
      REPLICATION_ADDR = "192.168.4.110:1689"
      RUN_LOG_FILE_PATH = "/home/wolf/workspace/yashandb/23.3.0.8/log/yashandb/db-1-1/run"
      RUN_LOG_LEVEL = "DEBUG"
      SLOW_LOG_FILE_PATH = "/home/wolf/workspace/yashandb/23.3.0.8/log/yashandb/db-1-1/slow"
      SSL_CERT_FILE = "/home/wolf/workspace/data/server.crt"
      SSL_DH_PARAM_FILE = "/home/wolf/workspace/yashandb/23.3.0.8/ssl/dhparam.pem"
      SSL_ENABLE = "ON"
      SSL_KEY_FILE = "/home/wolf/workspace/yashandb/23.3.0.8/ssl/server.key"
```

2、  配置ssl参数的主机能正常连接db，其他主机无法连接db

3、前置操作（手动执行）-- 生成ssl加密相关秘钥

详细内容见：    [SSL连接配置 | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E6%95%B0%E6%8D%AE%E5%BA%93%E7%AE%A1%E7%90%86/%E5%9F%BA%E6%9C%AC%E6%95%B0%E6%8D%AE%E5%BA%93%E7%AE%A1%E7%90%86/SSL%E8%BF%9E%E6%8E%A5%E9%85%8D%E7%BD%AE.html)  

```
$ mkdir -p /var/lib/jenkins/test/ssl
$ cd /var/lib/jenkins/test/ssl

$ openssl req -new -x509 -days 365 -nodes -out root.crt -keyout ca.key -subj "/CN=RootCA"

$ openssl req -new -nodes -text \
-out server.csr \
-keyout server.key \
-subj "/CN=server"

$ openssl x509 -req -in server.csr -text -days 5 \
-CA root.crt \
-CAkey ca.key \
-CAcreateserial \
-out server.crt

$ openssl dhparam -2 -out dhparam.pem -text 2048
```

4、不影响原有功能

## 2.2 应用场景

om配置ssl协议部署数据库

## 2.3 规格约束

只支持ssl

# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

*语法图–路径覆盖*

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


  


|测试场景|测试项一|测试项二|有效等价类|无效等价类|备注|
|:---|:---|:---|:---|:---|:---|
|功能校验|单主机|1. 执行前置操作
1. 部署单机、分布式、集群数据库
|在该主机上连接数据库成功（yasql/yasboot sql）,- 单机：连接主节点、备节点
- 分布式：连接cn、mn、dn（主/备）
- 集群：连接各节点（主/备）
,只有使用客户端安装路径才能连接至数据库。|其他主机上连接数据库失败（yasql/yasboot sql）：,YAS-00610 failed to connect ssl : certificate verify failed,  
,（无db节点）手动拷贝证书，连接成功,![](https://pingcode.yasdb.com/atlas/files/public/67396df1a1ad9a3311dc9476/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFRZ0FBQmhBQUNBQUFCQUFBQUFRQUFBQUNBQUFRQUFBQUFBQUFBQUFBUUJBQUFBRUFJQUFBQUFBQUFFQUFBRUFBQUFBQUFBQ0FJQUFBQUlBQWdBQUFSQWdBQUFBRUFRQUFBQUFRQUFBQUFBQUNBQUFLQUFBQWdBSUFFQUFBRUNDQUFBQUFBSUFBQUVBQUFBQ0FBQUFDQUFBQUFBQUFDQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMwNzIsImV4cCI6MTc4MjMyMzg3Mn0.IClztcSrgC-PknPUxdD8zt87PIJCn52VbKg4IJxWBX8),![](https://pingcode.yasdb.com/atlas/files/public/67396df18970c2af4f521604/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFRZ0FBQmhBQUNBQUFCQUFBQUFRQUFBQUNBQUFRQUFBQUFBQUFBQUFBUUJBQUFBRUFJQUFBQUFBQUFFQUFBRUFBQUFBQUFBQ0FJQUFBQUlBQWdBQUFSQWdBQUFBRUFRQUFBQUFRQUFBQUFBQUNBQUFLQUFBQWdBSUFFQUFBRUNDQUFBQUFBSUFBQUVBQUFBQ0FBQUFDQUFBQUFBQUFDQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMwNzIsImV4cCI6MTc4MjMyMzg3Mn0.IClztcSrgC-PknPUxdD8zt87PIJCn52VbKg4IJxWBX8)|一台机器上有om和db，另一台机器上有agent。,  
,install部署om，agent，拷贝ssl,deploy部署db|
|  
|  
|1. 未执行前置操作
1. 部署单机、分布式、集群数据库
|在该主机上连接数据库失败（yasql/yasboot sql）|  
|部署会失败|
|  
|  
|1. 未执行完整前置操作
    1. 仅生成  SSL_ROOT_CER文件
    1. 仅生成SSL_ROOT_CER、  SSL_KEY_FILE文件
    1. 仅生成SSL_ROOT_CER、SSL_KEY_FILE、SSL_CERT_FILE文件
    1. 仅生成SSL_DH_PARAM_FILE文件
1. 部署单机、分布式、集群数据库
|在该主机上连接数据库失败（yasql/yasboot sql）|  
|部署会失败|
|  
|  
|1. 执行前置操作
1. 生成配置文件（  hosts.toml/yashandb.toml  ）后手动修改相关参数（  **SSL_CERT_FILE、SSL_DH_PARAM_FILE、SSL_KEY_FILE、SSL_ROOT_CER、SSL_ENABLE**  ）
    1. 修改文件路径为相对路径
    1. 修改文件路径为其他路径
    1. 修改文件名
    1. 复制参数--toml解析错误
1. 部署单机、分布式、集群数据库
|  
|  
|  
|
|  
|多主机(主机A+主机B)|1. 主机A（安装机器）执行前置操作
1. 部署单机、分布式、集群数据库
|主机A上连接主机B节点,主机B上连接主机A节点|其他主机上连接数据库失败（yasql/yasboot sql）：ssl connection failed|机器B会先创建目录，再拷贝文件|
|  
|  
|1. 未执行前置操作
1. 部署单机、分布式、集群数据库
|  
|  
|  
|
|  
|  
|1. 未执行完整前置操作
    1. 仅生成  SSL_ROOT_CER文件
    1. 仅生成SSL_ROOT_CER、  SSL_KEY_FILE文件
    1. 仅生成SSL_ROOT_CER、SSL_KEY_FILE、SSL_CERT_FILE文件
    1. 仅生成SSL_DH_PARAM_FILE文件
1. 部署单机、分布式、集群数据库
|  
|  
|  
|
|  
|  
|1. 执行前置操作
1. 生成配置文件（  hosts.toml/yashandb.toml  ）后手动修改相关参数（  **SSL_CERT_FILE、SSL_DH_PARAM_FILE、SSL_KEY_FILE、SSL_ROOT_CER、SSL_ENABLE**  ）
    1. 修改文件路径为相对路径
    1. 修改文件路径为其他路径
    1. 修改文件名
    1. 复制参数
1. 部署单机、分布式、集群数据库
|  
|  
|  
|
|  
|根证书或二级证书过期|能否部署成功，能否连接成功|  
|  
|db内部功能|
|  
|目录B下重新生成证书|用目录A，能部署成功|  
|  
|  
|
|  
|证书内容为空|部署成功|  
|  
|破坏性测试|
|  
|证书类似scp到其他主机上|  
|  
|  
|  
|
|  
|卸载uninstall时，会删除相关文件|  
|  
|  
|删除yashandb数据目录，不会删除sslpath目录|
|参数校验|--ssl-protocol|  
|大小写（仅小写），位置，重复指定（后者生效）|拼写错误,在非package config gen命令中使用，如：package config join-demo、package upload、package install|  
|
|  
|  
|  
|指定为ssl|指定为其他|  
|
|  
|--ssl-path|  
|大小写（仅小写），位置，重复指定（后者生效）|拼写错误,在非package config gen命令中使用，如：package config join-demo、package upload、package install|  
|
|  
|  
|  
|绝对路径，相对路径（~/、./、../、?/）,路径长度（无限制）,路径带特殊字符|路径不存在,路径在yfs上|gen时不校验路径是否存在或是否合法,install时校验|
|  
|指定--ssl-protocol未指定--ssl-path|  
|  
|  
|报错|
|  
|指定--ssl-path未指定--ssl-protocol|  
|  
|  
|报错|
|  
|目前证书文件名不可变|SSL_CERT_FILE = "~/ssl/  **server.crt**  "    
  SSL_DH_PARAM_FILE = "~/ssl/  **dhparam.pem**  "    
  SSL_KEY_FILE = "~/ssl/  **server.key**  "    
  SSL_ROOT_CER = "~/ssl/  **root.crt**  "|  
|  
|资料注明|
|功能结合|扩缩容|增加服务器后，能否连接,![](https://pingcode.yasdb.com/atlas/files/public/67396df18970c2af4f521605/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFRZ0FBQmhBQUNBQUFCQUFBQUFRQUFBQUNBQUFRQUFBQUFBQUFBQUFBUUJBQUFBRUFJQUFBQUFBQUFFQUFBRUFBQUFBQUFBQ0FJQUFBQUlBQWdBQUFSQWdBQUFBRUFRQUFBQUFRQUFBQUFBQUNBQUFLQUFBQWdBSUFFQUFBRUNDQUFBQUFBSUFBQUVBQUFBQ0FBQUFDQUFBQUFBQUFDQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMwNzIsImV4cCI6MTc4MjMyMzg3Mn0.IClztcSrgC-PknPUxdD8zt87PIJCn52VbKg4IJxWBX8),![](https://pingcode.yasdb.com/atlas/files/public/67396df1a1ad9a3311dc9477/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFRZ0FBQmhBQUNBQUFCQUFBQUFRQUFBQUNBQUFRQUFBQUFBQUFBQUFBUUJBQUFBRUFJQUFBQUFBQUFFQUFBRUFBQUFBQUFBQ0FJQUFBQUlBQWdBQUFSQWdBQUFBRUFRQUFBQUFRQUFBQUFBQUNBQUFLQUFBQWdBSUFFQUFBRUNDQUFBQUFBSUFBQUVBQUFBQ0FBQUFDQUFBQUFBQUFDQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMwNzIsImV4cCI6MTc4MjMyMzg3Mn0.IClztcSrgC-PknPUxdD8zt87PIJCn52VbKg4IJxWBX8),![](https://pingcode.yasdb.com/atlas/files/public/67396df28970c2af4f521606/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFRZ0FBQmhBQUNBQUFCQUFBQUFRQUFBQUNBQUFRQUFBQUFBQUFBQUFBUUJBQUFBRUFJQUFBQUFBQUFFQUFBRUFBQUFBQUFBQ0FJQUFBQUlBQWdBQUFSQWdBQUFBRUFRQUFBQUFRQUFBQUFBQUNBQUFLQUFBQWdBSUFFQUFBRUNDQUFBQUFBSUFBQUVBQUFBQ0FBQUFDQUFBQUFBQUFDQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMwNzIsImV4cCI6MTc4MjMyMzg3Mn0.IClztcSrgC-PknPUxdD8zt87PIJCn52VbKg4IJxWBX8),![](https://pingcode.yasdb.com/atlas/files/public/67396df2a1ad9a3311dc9478/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFRZ0FBQmhBQUNBQUFCQUFBQUFRQUFBQUNBQUFRQUFBQUFBQUFBQUFBUUJBQUFBRUFJQUFBQUFBQUFFQUFBRUFBQUFBQUFBQ0FJQUFBQUlBQWdBQUFSQWdBQUFBRUFRQUFBQUFRQUFBQUFBQUNBQUFLQUFBQWdBSUFFQUFBRUNDQUFBQUFBSUFBQUVBQUFBQ0FBQUFDQUFBQUFBQUFDQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMwNzIsImV4cCI6MTc4MjMyMzg3Mn0.IClztcSrgC-PknPUxdD8zt87PIJCn52VbKg4IJxWBX8),![](https://pingcode.yasdb.com/atlas/files/public/67396df2a1ad9a3311dc9479/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFRZ0FBQmhBQUNBQUFCQUFBQUFRQUFBQUNBQUFRQUFBQUFBQUFBQUFBUUJBQUFBRUFJQUFBQUFBQUFFQUFBRUFBQUFBQUFBQ0FJQUFBQUlBQWdBQUFSQWdBQUFBRUFRQUFBQUFRQUFBQUFBQUNBQUFLQUFBQWdBSUFFQUFBRUNDQUFBQUFBSUFBQUVBQUFBQ0FBQUFDQUFBQUFBQUFDQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMwNzIsImV4cCI6MTc4MjMyMzg3Mn0.IClztcSrgC-PknPUxdD8zt87PIJCn52VbKg4IJxWBX8),![](https://pingcode.yasdb.com/atlas/files/public/67396df28970c2af4f521607/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFRZ0FBQmhBQUNBQUFCQUFBQUFRQUFBQUNBQUFRQUFBQUFBQUFBQUFBUUJBQUFBRUFJQUFBQUFBQUFFQUFBRUFBQUFBQUFBQ0FJQUFBQUlBQWdBQUFSQWdBQUFBRUFRQUFBQUFRQUFBQUFBQUNBQUFLQUFBQWdBSUFFQUFBRUNDQUFBQUFBSUFBQUVBQUFBQ0FBQUFDQUFBQUFBQUFDQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMwNzIsImV4cCI6MTc4MjMyMzg3Mn0.IClztcSrgC-PknPUxdD8zt87PIJCn52VbKg4IJxWBX8)|  
|  
|ssl部署成功后，  扩容命令不加ssl参数部署成功（无新增服务器）。部署失败（新增服务器）,ssl部署成功后，扩容加ssl参数成功,注意单机分布式,扩容失败不会回滚，需手动缩容清理|
|  
|  
|扩容命令增加ssl参数,config node gen（cn，备库）,config group gen（dn组）|  
|  
|开启ssl后 分布式不支持增加dn组,开启ssl后，增加cn，备库成功,集群暂不支持扩容|
|  
|yasboot ipchange（不相关）|更换主机ip后，能否连接|  
|  
|  
|


|系统级DFX分类|是否涉及|测试点|
|---|---|---|
|CT|  
|  
|
|KT|  
|  
|
|长稳|  
|  
|
|一致性|  
|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|  
|
|安全|  
|  
|
|DFR|  
|  
|
|HA|  
|  
|
|压力|  
|  
|
|性能|  
|  
|
|可维护性|  
|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|单机、分布式、集群|


# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZjE4OTcwYzJhZjRmNTIxNWZkIiwicmVmX2lkIjoiNjczOTZkZjA1OTNmOTljOWZmMjM4MTA0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzMDcyLCJleHAiOjE3ODIzOTk0NzJ9.hCyMTZkB0CrQEQsGZOE28XhSH6A_jkrtcW-DeQJRb1c)

## Attachments:

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZjE4OTcwYzJhZjRmNTIxNWZkIiwicmVmX2lkIjoiNjczOTZkZjA1OTNmOTljOWZmMjM4MTA0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzMDcyLCJleHAiOjE3ODIzOTk0NzJ9.hCyMTZkB0CrQEQsGZOE28XhSH6A_jkrtcW-DeQJRb1c)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZjFhMWFkOWEzMzExZGM5NDcwIiwicmVmX2lkIjoiNjczOTZkZjA1OTNmOTljOWZmMjM4MTA0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzMDcyLCJleHAiOjE3ODIzOTk0NzJ9.a4Z4cklN-i7j_ygYGUC84DATCwLWscsmmzTLrI66bAc)

 (application/msword)    


[image2024-9-25_17-26-52.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZjE4OTcwYzJhZjRmNTIxNWZmIiwicmVmX2lkIjoiNjczOTZkZjA1OTNmOTljOWZmMjM4MTA0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzMDcyLCJleHAiOjE3ODIzOTk0NzJ9.G_dCQ9hWAawVtQ_TKLVJ_KRCe9Skj27WeVrKECsZz1E)

 (image/png)    


[image2024-9-25_17-28-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZjFhMWFkOWEzMzExZGM5NDczIiwicmVmX2lkIjoiNjczOTZkZjA1OTNmOTljOWZmMjM4MTA0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzMDcyLCJleHAiOjE3ODIzOTk0NzJ9.0hURKxfDAOPRPPEQdQaaIIPL4Kdh0Gzb21h50NowLng)

 (image/png)    


[image2024-9-25_17-42-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZjFhMWFkOWEzMzExZGM5NDc0IiwicmVmX2lkIjoiNjczOTZkZjA1OTNmOTljOWZmMjM4MTA0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzMDcyLCJleHAiOjE3ODIzOTk0NzJ9.5i-4Wkjyd5KwiAUfg-1tX1MRds4O2l6jFt7vLHtSSE0)

 (image/png)    
