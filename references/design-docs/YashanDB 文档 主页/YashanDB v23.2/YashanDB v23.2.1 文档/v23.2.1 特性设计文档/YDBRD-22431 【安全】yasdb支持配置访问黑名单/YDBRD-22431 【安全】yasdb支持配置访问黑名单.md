Created by 史鑫, last modified on 十月 18, 2024

  [IP白名单 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=83921479)  

在以上基础上，增加黑名单

#### 配置：

tcp.excluded_nodes

tcp.validnode_checking=YES

|黑|白|效果|
|---|---|---|
|不配|不配|server启动报错|
|不配|配|白为准，白以外，全禁止|
|配|不配|黑为准，黑以外，全放行|
|配|配|先检查黑，再检查白。有冲突以黑为准。|


规则：

1.先检查黑，再检查白。黑全禁止，白全放行。黑白都配，必须在白内/黑外，才能登录。

（黑/白重复，以黑为主）

2.当黑白任意一个不配置，则认为其不配置的名单全部通过。

配置文件路径：  **$YASDB_DATA\config\yasdb_net.ini**

```
TCP.VALIDNODE_CHECKING = yes
  TCP.INVITED_NODES = 127.0.0.1/0
  TCP.EXCLUDED_NODES = fc00:7::109/128
```

## 部署形态的影响：

**C/S的监听**  ：集群/分布式/单机，客户端的监听线程对应的业务回调函数都是anrServiceAccept，在此控制黑白名单，对部署形态透明。

**节点内部的监听**  ：监听线程/监听的回调函数都是自己的，黑名单的配置不影响节点间的通信。

## 冒烟用例自测

**1.黑白名单混合配置**

|用例编码|测试场景|参数配置|期望结果|
|:---|:---|:---|:---|
|用例编码|测试场景|参数配置|结果|
|TS01-1|开启检验，TCP.VALIDNODE_CHECKING=yes,且EXCLUDED_NODES与INVITED_NODES   ,（1）均不填   ** --完成**,（2）均为非法值   **--完成**,（3）其中任意一个为非法值（预期报错信息至对应名单）  ** --完成**,  
|  
,  
|报错,[root@AchorBase bin]# ./yasdb    
  Starting instance nomount    
  failed to load netconfig: address 192.168.7.109/1111 is invalid    
  Failed to start instance,  
,[root@AchorBase bin]# ./yasdb    
  Starting instance nomount    
  valid URL of service expected    
  Failed to start instance|
|TS01-2|TCP.VALIDNODE_CHECKING=no,EXCLUDED_NODES与INVITED_NODES随便配置（合法与非法）  **--完成**|TCP.VALIDNODE_CHECKING  =|[root@AchorBase bin]# ./yasdb    
  Starting instance nomount    
  Instance started|
|TS01-3|开启检验，TCP.VALIDNODE_CHECKING=yes ,且EXCLUDED_NODES与INVITED_NODES   均为合法配置时   **--完成**,  
|TCP.VALIDNODE_CHECKING  =yes,127.0.0.1；,127.0.0.1/mask (mask 范围[0,32])；,非本机 IP；,非本机 IP/mask (mask 范围[0,32]),IP 地址一行填多个，以逗号隔开：127.0.0.1/8,127.0.0.1:32|  
,配置成功，服务成功部署|
|TS02|在TS01-3场景服务部署成功后，访问IP去访问该服务时又分为  本机物理IP，其它物理IP两类，每类IP在服务端的配置分为黑，白，非黑非白，黑白这4种情况。共计8种场景|通过修改部署TS01-3时的配置文件然后客户端进行访问，查看是否成功即可|满足在白名单中的非黑名单能够访问   **--完成**|
|TS03-1|考虑一下部署情况分为本地回环与物理IP，,  
|  
|例如监听127.0.0.1，然后把192.168.6.176这个IP拉黑，但是本机还是能访问的。反之亦然。   **--完成**|
|TS03-2|考虑配置ipv6黑名单|参考资料：    [ipv6唯一本地地址配置](https://conf.yasdb.com/pages/viewpage.action?pageId=122063617)  |配置ipv6成功生效   **--完成**|


**2.黑名单单独配置**

|用例编码|测试场景|参数设置|期望结果|
|:---|:---|:---|:---|
|TS04|开启检验，TCP.VALIDNODE_CHECKING=yes,只配置  EXCLUDED_NODES|多个配置：,1）TCP.VALIDNODE_CHECKING 配置多行,2）TCP.  EXCLUDED_NODES   配置多行|1、TCP.VALIDNODE_CHECKING 有多个时，以最后一个配置为准   **--完成**,2、TCP.  EXCLUDED_NODES   多个配置，则追加，只要访问 IP 满足任意一个即没有访问权限    **--完成**|


**3.集群与分布式单实例配置测试**

|用例编码|测试场景|参数设置|期望结果|
|:---|:---|:---|:---|
|TS06|分布式：CN配置，将客户端禁掉   **--完成**,  
|TCP.VALIDNODE_CHECKING  =yes,node1：在黑（在不在白）两种,node2：connect|访问node1失败，访问node2成功|
|  
|  
|  
|  
|


文档相关：

补充约束：黑白名单不支持域名。   **--完成**