Created by 侯忠林, last modified on 七月 02, 2024

##   [1. Overview（概述）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#1-overview%E6%A6%82%E8%BF%B0)  

目前连接模式支持primary只连接主库，增加standby后可实现应用的读写分离，将只读应用连接到备机。

##   [2. Features（功能特性）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

新增  standby的连接模式

##   [3. Interfaces（接口）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#3-interfaces%E6%8E%A5%E5%8F%A3)  

暂无

  


  [4. Limitations（功能限制）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

1. standby模式只连接备机，没有备机则连接失败
1. TAF的触发后也同样连接备机。


##   [5. Detail Design（详细设计）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

### 1. 相关的配置

JDBC配置，在高可用主备支持只读：

**URL=jdbc:yasdb:**  **standby**  **:192.168.1.2:1688,192.168.1.3:1688,192.168.1.4:1688**

新增参数  **standby 不区分大小写，参数也不区分大小写**  。

在高可用主备TAF模式下同样支持：

主备：jdbc:yasdb:standby    [://192.168.1.1:1688,192.168.1.2:1688,192.168.1.3:1688/yashan?](primary://192.168.1.1:1688,192.168.1.2:1688,192.168.1.3:1688)      [failover=on&failoverType=basic&failoverMethod=session&failoverRetries=2](yasdb://192.168.1.1:1688/yashan?connecTimeout=60&socketTimeout=120&loginTimeout=60&serverMode=dedicated)      [0](primary://192.168.1.1:1688,192.168.1.2:1688,192.168.1.3:1688)      [&failoverDelay =1](yasdb://192.168.1.1:1688/yashan?connecTimeout=60&socketTimeout=120&loginTimeout=60&serverMode=dedicated)      [5](primary://192.168.1.1:1688,192.168.1.2:1688,192.168.1.3:1688)  

### 2. 实现

在原来primary的模式基础下，修改判断当前节点为主节点的，改为判断当前节点为备用只读节点。

##   [6. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

1.配置参数能够正常使用获取到正确配置

2. 能够按照ip顺序连接只读节点

2.只读模式下能够正常触发TAF，并且连接只读节点。

##   [7. Workload（工作量）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#7-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

*评估代码量KLOC、工作量（人天）。*

代码100+行，工作量2天。

##   [8. TODO（遗留问题）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*

达梦对应功能：

loginMode 指定优先登录的服务器模式。    
  0：优先连接 PRIMARY 模式的库，NORMAL 模式次之，最后选择 STANTBY 模式；    
  1：只连接主库；    
  2：只连接备库；    
  3：优先连接 STANDBY 模式的库，PRIMARY 模式次之，最后选择 NORMAL 模式；    
  4：优先连接 NORMAL 模式的库，PRIMARY 模式次之，最后选择 STANDBY 模式；默认 4；

怎么和达梦对齐？