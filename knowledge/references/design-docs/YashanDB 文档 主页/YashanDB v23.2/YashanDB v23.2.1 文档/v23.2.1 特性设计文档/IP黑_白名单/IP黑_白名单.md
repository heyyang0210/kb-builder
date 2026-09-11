Created by 史鑫, last modified on 五月 13, 2024

#   [User Design（用户方案设计）](#user-design用户方案设计)  

##   [1. Overview（概述）](#1-overview概述)  

黑白名单的方式，提供数据库防火墙能力。

现针对TCP的连接，控制特定ip的连接。（uds不限制）

##   [2. Features（功能特性）](#2-features功能特性)  

（1）支持IP黑/白名单设置。

（2）ini文配置，  **重启生效**  ；

（3）支持ipv4/ipv6。

###   [2.1 使用过程](#21-使用过程)  

## 参数说明

|参数名|意义|格式|
|---|---|---|
|TCP.VALIDNODE_CHECKING|是否生效控制|yes/no，配置除了yes之外，都为no。|
|TCP.INVITED_NODES|白名单|（1）范围设置,TCP.INVITED_NODES=  127.0.0.1/32,mask范围：[0,32] 意义：值为8，则表示，只匹配第一个字节：127,（2）单独设置,TCP.INVITED_NODES=192.0.0.1 相当于mask为32，全匹配|
|TCP.EXCLUDED_NODES|黑名单|规则同INVITED_NODES|


（1）重启后，读取ini配置文件

（2）lisnr线程判断。

（3）用户自己手动创建文件，库中不带此文件。文件不存在，不报错；tcp.validnode_checking!=yes 不加载ip；tcp.validnode_checking==yes 加载ip，当ip的规则不符合要求，无法启动实例；tcp.validnode_checking配置非yes/no，为no，可正常启动。

（4）配置文件中，有非法配置项，可启动。

（5）配置文件路径：  **$YASDB_DATA\config\yasdb_net.ini**

## 检查规则

1.先检查黑，再检查白。黑全禁止，白全放行。黑白都配，必须在白内/黑外，才能登录。

（黑/白重复，以黑为主）

2.当黑白任意一个不配置，则认为其不配置的名单全部通过。    [black tables - 史鑫 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/~shixin/black+tables)  

## 部署形态的影响：

**C/S的监听**  ：集群/分布式/单机，客户端的监听线程对应的业务回调函数都是anrServiceAccept，在此控制黑白名单，对部署形态透明。

**节点内部的监听**  ：监听线程/监听的回调函数都是自己的，黑名单的配置不影响节点间的通信。

##   [3. Interfaces（接口）](#3-interfaces接口)  

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

（1）不支持通配符：127.*.*.0

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

![](https://pingcode.yasdb.com/atlas/files/public/67396c108970c2af4f520904/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg5NTYsImV4cCI6MTc4MjMwOTc1Nn0.-dI3-qFlWXFBxwkDltCX-9TXSIrKevo5utr03cP-Ax4)

整体规则

（1）防火墙的检查，越早越好，因此要在资源申请前（AnrSession/AnlHnalder/AnkHnalder），IP进行过滤

（2）lsnr线程进行检查。LSNR线程不要有任何的IO。此线程处理必须快速，否则大量并发请求，tcp的accpet效率低，会丢失连接。

###   [5.2 详细设计](#52-详细设计)  

```
typedef struct StAnrListener {
    ConnQueue serviceQueue;
    TcpLsnr   tcp;
    IpcLsnr   ipc;
    NetConfig netConfig; //网络配置参数
} AnrListener;
```

```
typedef struct StNetAuthMethod {
    CodChar osGroup[COD_NAME_BUFFER_SIZE];
    CodBool enableLocalOsAuth;
    CodBool unused[3];
} NetAuthMethod;//OS Auth

typedef struct StNetConfig {
    List*         invitedList;
    List*         excludedList;
    CodBool       check;
    CodBool       unused[7];
    NetAuthMethod authMethod;
} NetConfig;
```

### 加载：

127.0.0.1/24 与127.0.0.1

addr 设置 ： SocketAddr→in4.sin_addr.S_addr（四字节）127.0.0.1  点分十进制转成二进制存储

maskAddr设置：SocketAddr→in4.sin_addr.S_add  mask：24  S_add 为ff:ff:ff:00；没有设置mask，为全匹配：mask为ff:ff:ff:ff

### 认证：

lsnr线程处理，向客户端发送第一次握手协议前，认证ip；

条件：（名单中ip(二进制) ^ 连接ip） & mask == 0，可建立连接

### 释放：

逻辑判断在lsnr线程，在申请资源前，进行限制。当lsnr线程关闭后，释放NetConfig，避免并发问题。

具体认证的过程：

```
例子：
文件中配置：TCP.INVITED_NODES=255.1.1.1/8
socketAddr ipv4 4字节-二进制
 item包含
 配置 IP    
 255.1.1.1 -- ff010101
 8         -- ff000000
 
 请求的IP  
ff020202   -- 255.2.2.2
ff010101^ff020202   00030303
00030303 & ff000000 == 0000000 成功
```

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

（1）错误的ip，重复的ip配置。

tcp.validnode_checking参数

（2）ipv4，ipv6配置，ipv6先报错。

（3）本地连接不进行限制。

自测：

|测试项|参数|值|预期|  
|
|---|---|---|---|---|
|正确性|tcp.validnode_checking |yes|no|其他值，不报错，除了  **yes以外，都为no**|启动不报错|
|正确性|TCP.INVITED_NODES|127.3.3.3/-1,127.3.3.3/0,127.3.3.3/24,127.3.3.3/32,127.3.3.3/33,127.0.0.1 -不加mask|127.3.3.3/-1、127.3.3.3/33–报错,127.3.3.3/0、127.3.3.3/24、127.3.3.3/32 --均不报错|Starting instance nomount    
  address 192.168.0.0/-1 is an invalid URL/Ip address/hostname    
  Failed to start instance,[root@AchorBase bin]# ./yasdb    
  Starting instance nomount    
  address 192.168.0.0/33 is an invalid URL/Ip address/hostname    
  Failed to start instance,  
|
|重复设置|tcp.validnode_checking,TCP.INVITED_NODE|tcp.validnode_checking = yes,TCP.INVITED_NODES = 127.1.1.1/32,TCP.INVITED_NODES = 127.1.1.1/0,tcp.validnode_checking = no|（1）tcp.validnode_checking = no后面会将其覆盖；,（1）tcp.INVITED_NODES 后面  **会追加**  ；,（2）TCP.INVITED_NODES 只要有一个符合要求，就能连上（ip+掩码有一个满足即可）|  
|
|特殊ip|ipv6设置|tcp.validnode_checking = yes,TCP.INVITED_NODES = fe80::edf7:596:637e:89ab|Starting instance nomount    
  address fe80::edf7:596:637e:89ab is an invalid URL/Ip address/hostname    
  Failed to start instance|  
|
|validnode_checking与INVITED_NODES|（1）,tcp.validnode_checking =yes,TCP.INVITED_NODES不设置,（2）,tcp.validnode_checking =no,TCP.INVITED_NODES设置|  
|（1）报错（oracle无法起监听）,（2）所有都能登录|（1）Starting instance nomount    
  valid URL of service expected    
  Failed to start instance|
|错误配置项|aa=aa|  
|启动时，不报错，忽略此选项|ok|


##   [7. Workload（工作量）](#7-workload工作量)  

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

（1）是否有 视图查询名单?

（2）是否 支持sql语句设置黑白名单，还是只能手改文件？ --只改文件

（3）黑白名单个数上限；涉及内存中数组的申请。    [List - 史鑫 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/~shixin/List)  

（4）支持重新加载文件信息。

（5）黑白名单的关系，黑名单白名单有交集；黑白名单之外的ip，是否禁用。

优化点：

（1）数据结构，不采用链表，树形结构

（2）黑名单怎么支持。

（3）uds在外部判断。

--oracle

（1）文件路径：\oracle\network\admin\sqlnet.ora

## Attachments:

[image2022-7-24_15-15-58.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMTA4OTcwYzJhZjRmNTIwOTAzIiwicmVmX2lkIjoiNjczOTZjMTA3MjgyMDZlZmI5MmYwZDM4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4OTU2LCJleHAiOjE3ODIzODUzNTZ9.-DAfQkwQ2txNkUzrb3_NqEicbaX7dYeYaiCg1IzTRmI)

 (image/png)    
