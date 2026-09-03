Created by 侯忠林, last modified on 二月 02, 2024

##   [1. Overview（概述）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#1-overview%E6%A6%82%E8%BF%B0)  

目前深燃外场在进行OCI切换的时候，原来使用的是mySql,支持在主备模式下的多ip配置，所以需要崖山也支持同样的特性。

##   [2. Features（功能特性）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

支持功能：

C驱动支持数据多IP的URL，或者在C驱动的配置文件$YASDB_HOME  "  /client/yasc_service.ini支持多ip的配置。

在TAF进行连接切换的过程中，多IP的方式同样以上面方式进行

支持HA的primary模式的链接方式。

支持集群的loadbalance模式链接方式。

##   [3. Interfaces（接口）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#3-interfaces%E6%8E%A5%E5%8F%A3)  

|接口|类型|说明|
|:---|:---|:---|
|yacConnect|修改|第二个参数url支持输入多ip。|


  


##   [4. Limitations（功能限制）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

无。

  


##   [5. Detail Design（详细设计）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

#### 1.yacConnect 接口支持多ip

支持输入类似：

|  `//单机`      
    `const`         `YacChar* url1= `      `"127.0.0.1:1688"`      `;`      
    `//HA，primary模式`      
    `const`         `YacChar* url2= `      `"127.0.0.1:1688,127.0.0.1:1689,127.0.0.1:1690"`      `;`      
    `const`         `YacChar* url3= `      `"primary:127.0.0.1:1688,127.0.0.1:1689,127.0.0.1:1690"`      `;`  ,  `//loadbalance模式`  ,  `const`         `YacChar* url3= `      `"loadbalance:127.0.0.1:1688,127.0.0.1:1689,127.0.0.1:1690"`      `;`  |
|:---|


支持关键字primary，如果配置多IP，没有配置模式，默认为primary模式。（后续多IP需要支持集群负载均衡loadBalance模式）。

#### 2.yasc_service.ini支持多ip的配置

在配置文件中配置如下：

CITEST = 127.0.0.1:1688 //单机    
  REMOTE = 127.0.0.1:1688,127.0.0.1:1689,127.0.0.1:1690 //HA

或者

REMOTE = primary:127.0.0.1:1688,127.0.0.1:1689,127.0.0.1:1690 //HA

同样支持关键字primary，如果配置多IP，没有配置模式，默认为primary模式。

支持关键字loadBalance。

#### 3.多IP primary模式链接策略

(1).每次链接首先链接第一个ip/port；

(2)如果能够连接上则判断当前是否是主机；

(3).如果是主机则链接成功，后续的ip/port直接舍弃不用；

(4).如果不是主机则中断当前链接，连接下一个ip/port重复2步骤；

(5).如果连接到最后一个ip/port还是没有发现主机则整个连接过程连接失败返回异常；

(6). TAF模式下，多ip优先连接下一个ip，然后轮询一遍所有ip。

#### 4.多IP loadBalance模式链接策略

(1).每次链接首先随机链接一个ip/port；

(2)如果能够连接上则判断当前ip上的session个数；

(3).连接下一个ip并记录ip上的session个数；

(4).对比所有能连接上的ip的个数；

(5).如果连接到最后一个ip/port还是没有可用连接则整个连接过程连接失败返回异常；

(6). TAF模式下，多ip优先连接下一个ip，如果连接的节点个数相等则随机选择一个，然后轮询一遍所有ip，

#### 5.实现方式

(1).支持解析URL和文件yasc_service.ini的内容解析；

(2) 支持解析关键字primary，loadBalance，能够正确的识别到连接的模式；

(3) 直接解析出多ip/port；

(4) 支持primary模式下多ip的轮询策略；

(5) 支持loadBalance模式下多ip的轮询策略；

(5).TAF模式下，要先记录当前连接ip的位置，在触发TAF的时候先连接下一个节点。例如多ip节点有，1，2，3，4，5。当前连接在2节点发生了TAF，则TAF的连接顺序是3，4，5，1，2。

(6) TAF模式下，loadBalance模式，触发TAF，则从当前节点开始连接下一个节点，默认不使用当前节点，除非其他节点都连接不上，才会使用当前节点。例如多ip节点有，1，2，3，4，5。当前连接在2节点发生了TAF，则TAF的连接顺序是3，4，5，1。对比以上四个节点上的session个数，去session最少的连接，如果连接个数相等则随机选择一个，如果上面三个节点都无法连接成功，则连接2节点，2节点能够连接成功则连接成功，否则进入下一个连接轮询。

(7) 判断节点个数SELECT COUNT(*) FROM V$SESSION WHERE TYPE!='BACKGROUND'

##   [6. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

1.单机的配置url能够正常连接。

2. 单机的文件配置能够正常连接。

3.primary的配置url能够正常连接。

4.loadBalance的配置url能够正常连接。

5.primary的文件配置能够正常连接  。

6.loadBalance的文件配置能够正常连接。

7.其他关键字的连接模式不支持抛出异常。

8.测试分布式切换过程中连接正常。

9.分布式主备切换过程中能够正常连接。

10.在TAF进行连接切换的过程中，HA连接IP的方式同样以上面方式进行

11. TAF过程中的ip顺序正确，不会卡死。

##   [7. Workload（工作量）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#7-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

  


*评估代码量KLOC、工作量（人天）。*

*业务代码100行左右，工作量4人天。*

  


##   [8. TODO（遗留问题）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

无。