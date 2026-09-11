Created by 高亚宁, last modified on 十一月 09, 2023

## 1.   **概述**

-   [1. 概述](#id-【YDBRD17173】YCS支持IPV6测试设计-1.概述)  
-   [2. 需求分析  ](#id-【YDBRD17173】YCS支持IPV6测试设计-2.需求分析)  
    -   [2.1 SR：YCS支持IPV6](#id-【YDBRD17173】YCS支持IPV6测试设计-2.1SR：YCS支持IPV6)  
-   [3. 测试设计方法](#id-【YDBRD17173】YCS支持IPV6测试设计-3.测试设计方法)  
    -   [3.1 特性关联领域分析：](#id-【YDBRD17173】YCS支持IPV6测试设计-3.1特性关联领域分析：)  
    -   [3.2 测试设计：](#id-【YDBRD17173】YCS支持IPV6测试设计-3.2测试设计：)  
-   [4. 详细测试设计   ](#id-【YDBRD17173】YCS支持IPV6测试设计-4.详细测试设计)  
-   [5. 测试用例](#id-【YDBRD17173】YCS支持IPV6测试设计-5.测试用例)  
-   [6. 测试框架设计](#id-【YDBRD17173】YCS支持IPV6测试设计-6.测试框架设计)  
-   [7. 测试环境说明](#id-【YDBRD17173】YCS支持IPV6测试设计-7.测试环境说明)  


本文描述集群ycs/ycr支持ipv6地址的测试设计

## 2.   **需求分析**

### 2.1 SR：YCS支持IPV6

链接：    [YDBRD-17173](https://jira.yasdb.com/browse/YDBRD-17173?src=confmacro)    -  YCS支持IPV6  完成

设计文档：    [yasdb系统进程支持ipv6 - 陈俊杰 - SICS-CoD Confluence](https://conf.yasdb.com/pages/viewpage.action?pageId=119555257)  

功能：

- 支持手动修改集群中的CLUSTER_INTERCONNECT、INTER_URL、LISTEN_ADDR为ipv6格式，能正常部署集群
- 支持ycsctl工具管理ipv6部署的集群
- ipv6部署的集群发生异常时能正确处理


限制：

1. ipv6地址需要手动修改配置文件进行设置
1. **ipv6地址格式**
    1. 带端口号：  **[**     fc00:7::126     **]**     : port
    1. 不带端口号： fc00:7::126
1. link-local链路本地地址的输入格式为" [ link-local addr  ** **  **% 接口号**     ] : port "，如[  fe80::d5a0:6043:483c:4bfd%ens192]: 1234
1. 集群内不支持混用ipv4和ipv6——不会拦截，om会拦截，整个集群级别
1. ycsctl add node指令不能单独使用


## 3.   **测试设计方法**

### 3.1 特性关联领域分析：

1. 视图：  检查与ip相关的各个视图中的ipv6地址格式，v$archive_dest、v$archive_dest_status、v$replication_status、V$SESSION、V$NODE
1. 参数：show parameter查看ipv6地址，ycsctl show config 和ycsctl status，ycs日志和db runlog
1. 功能——重点    
  a. 与ip有关的参数：CLUSTER_INTERCONNECT、LISTEN_ADDR、REPLICATION_ADDR、ARCHIVE_DEST_n、YCS节点之间通信的URL（ycsctl add node yas0 192.168.30.12:1880）    
  b. 地址格式校验    
  c. 使用ipv6能够正常部署集群/集群ha    
  d.  部署成功后，执行ycs/实例启停，可以修改参数为ipv6的地址
1. 异常/可靠性：kill yascs或者yasdb，节点间能正常通信
1. 部署形态：分机部署集群3实例、分机部署一主2备
1. 梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点


|专项|是否涉及|
|:---|:---|
|并发|  
|
|长稳|是|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|是|
|DFR/testkill|是|
|HA|是|
|压力|  
|
|性能|  
|
|可维护性|  
|
|资料|是|


### 3.2 测试设计：

主要采用  场景法和错误推测法进行设计

## 4.   **详细测试设计**

|  
|测试场景|用例详细描述|预期|测试结果|备注|
|:---|:---|---|---|---|:---|
|1|ipv6地址设置：LISTEN_ADDR、CLUSTER_INTERCONNECT、REPLICATION_ADDR、ARCHIVE_DEST_n|使用ipv6的地址部署集群一主2备环境，修改  LISTEN_ADDR、CLUSTER_INTERCONNECT、REPLICATION_ADDR、ARCHIVE_DEST_n为合法的ipv6地址（链路本地地址FE80::/10）,连接yasql,show parameter查看,ycsctl show config 和ycsctl status查看,在ycs日志和db的runlog中查看地址|修改成功，生效后显示为配置的ipv6地址，日志中的地址显示正确||**ipv6地址格式**,1. 带端口号：  **[**     fc00:7::126     **]**     : port
1. 不带端口号： fc00:7::126
1. 8组，每组4位
,link-local链路本地地址的输入格式为" [ link-local addr  ** **  **% 接口号**     ] : port "，如[  fe80::d5a0:6043:483c:4bfd%ens192]: 1234|
|2|  
|使用ipv6的地址部署集群一主2备环境，修改  LISTEN_ADDR、CLUSTER_INTERCONNECT、REPLICATION_ADDR、ARCHIVE_DEST_n为合法的ipv6地址（唯一本地地址FC00::/7）,连接yasql（本地连接，跨机连接）,show parameter查看,ycsctl show config 和ycsctl status查看|修改成功，生效后显示为配置的ipv6地址，日志中的地址显示正确||  
|
|3|  
|使用ipv6的地址部署分机集群3实例，修改  LISTEN_ADDR、CLUSTER_INTERCONNECT、REPLICATION_ADDR、ARCHIVE_DEST_n为合法的ipv6地址（环回地址::1/128）,连接yasql,show parameter查看,ycsctl show config 和ycsctl status查看|修改成功，生效后显示为配置的ipv6地址，日志中的地址显示正确||只支持单机部署集群多实例，不支持分机部署，因为别的机器ping不通它的环回地址|
|4|  
|用ipv4映射的ipv6地址|部署成功，功能和展示正常||功能校验时覆盖ipv6和ipv4|
|5|  
|使用ipv6的地址部署集群一主2备环境，修改  LISTEN_ADDR、CLUSTER_INTERCONNECT、REPLICATION_ADDR、ARCHIVE_DEST_n为不合法的ipv6地址（覆盖三种ipv6地址）：,1. 9组16进制数：  fe80:d5a0:6043:483c:4bfd:fe80:d5a0:6043:483c
1. 8组16进制数，但是有的组内不是4位：  fe80:d5a0:6043:483c:4bfd:fe80:da0:6043:43，最左边的0可以省略
1. 8组16进制数，每组4位，但包含非16进制数、特殊字符
1. 7组，不带::
1. 有多个::
1. 带端口号时，ip未使用[]
1. 只带端口号
1. link-local链路本地地址的输入格式错误（ [ link-local addr  ** **  **% 接口号**     ] : port "）：接口号错误，端口不对，格式不对，包含中文特殊字符等
1. 混用ipv4和ipv6
1. ipv6格式正确，但无法连通——设置的时候不报错，但是影响通信
|修改报错，提示信息明确||ipv6格式未做校验|
|6|  
|ipv6地址格式正确，但与其他参数的ip重复|设置不报错，重启时报错||failed to create listener, host: ::ffff:192.168.7.91:1601    
  YAS-00402 failed to bind socket, errno 98, error message "Address already in use"    
  Failed to start instance|
|7|  
|ycsctl add node name url,1. ipv6格式正确，且能够连通
1. ipv6格式正确，但无法连通
1. ipv6格式错误
|1. add node成功
1. add node失败
1. add node失败
|  
|  
|
|8|DB/实例启停|启停ycs|启停成功||  
|
|9|  
|启停instance|启停成功||  
|
|10|yasrman|连接ipv6地址，做备份恢复|备份恢复成功——暂不支持|阻塞|  
|
|11|异常/可靠性|kill 重启yascs|重启后，节点间正常通信||在2实例上测试，3实例不支持故障恢复|
|12|  
|kill 重启yasdb|重启后，节点间正常通信||  
|
|13|  
|构造网络丢包、单通等网络故障，再恢复网络|故障恢复后，数据库正常运行|阻塞|  
|
|14|安全|使用扫描工具，检测是否有未经授权的服务或者常见的ipv6漏洞|  
|未执行|地址分配问题、路由协议漏洞和配置错误等|


## 5.   **测试用例**

  


## 6.   **测试框架设计**

本次测试为手动测试。

  


## 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[image2023-6-1_9-22-43.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZjdhMWFkOWEzMzExZGM3OWQwIiwicmVmX2lkIjoiNjczOTY5ZjY3MjgyMDZlZmI5MmVmOTUyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNDI1LCJleHAiOjE3ODIyOTY4MjV9.xneeO79f8NUC5bcf3hDikkwaX-TE69PID4n9OVEfccY)

 (image/png)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Zjc4OTcwYzJhZjRmNTFmYjVhIiwicmVmX2lkIjoiNjczOTY5ZjY3MjgyMDZlZmI5MmVmOTUyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNDI1LCJleHAiOjE3ODIyOTY4MjV9.4efI6rYbUZUnvn9E5slLXtUN8jfwSNVWkmK3aH4kNS0)

 (image/svg+xml)    
