Created by 徐凡博, last modified on 十一月 08, 2023



-   [一、概述](#id-【YDBRD13487】【共享集群】集群工具ycsctl支持启停节点，启停资源，以及查询拓扑状态测试设计-一、概述)  
-   [二、需求分析](#id-【YDBRD13487】【共享集群】集群工具ycsctl支持启停节点，启停资源，以及查询拓扑状态测试设计-二、需求分析)  
-   [三、规格/范围](#id-【YDBRD13487】【共享集群】集群工具ycsctl支持启停节点，启停资源，以及查询拓扑状态测试设计-三、规格/范围)  
-   [四、约束限制](#id-【YDBRD13487】【共享集群】集群工具ycsctl支持启停节点，启停资源，以及查询拓扑状态测试设计-四、约束限制)  
-   [五、动态视图/配置参数](#id-【YDBRD13487】【共享集群】集群工具ycsctl支持启停节点，启停资源，以及查询拓扑状态测试设计-五、动态视图/配置参数)  
-   [六、测试设计方法](#id-【YDBRD13487】【共享集群】集群工具ycsctl支持启停节点，启停资源，以及查询拓扑状态测试设计-六、测试设计方法)  
    -   [6.1 对YCSCTL命令行进行测试](#id-【YDBRD13487】【共享集群】集群工具ycsctl支持启停节点，启停资源，以及查询拓扑状态测试设计-6.1对YCSCTL命令行进行测试)  
        -   [6.1.1 公共场景测试：](#id-【YDBRD13487】【共享集群】集群工具ycsctl支持启停节点，启停资源，以及查询拓扑状态测试设计-6.1.1公共场景测试：)  
        -   [6.1.2 业务场景测试：](#id-【YDBRD13487】【共享集群】集群工具ycsctl支持启停节点，启停资源，以及查询拓扑状态测试设计-6.1.2业务场景测试：)  
    -   [6.2 对并发读写进行测试](#id-【YDBRD13487】【共享集群】集群工具ycsctl支持启停节点，启停资源，以及查询拓扑状态测试设计-6.2对并发读写进行测试)  
-   [七、详细测试设计](#id-【YDBRD13487】【共享集群】集群工具ycsctl支持启停节点，启停资源，以及查询拓扑状态测试设计-七、详细测试设计)  
-   [八、测试用例](#id-【YDBRD13487】【共享集群】集群工具ycsctl支持启停节点，启停资源，以及查询拓扑状态测试设计-八、测试用例)  
-   [九、测试框架/测试用例自动化](#id-【YDBRD13487】【共享集群】集群工具ycsctl支持启停节点，启停资源，以及查询拓扑状态测试设计-九、测试框架/测试用例自动化)  
-   [十、测试环境说明](#id-【YDBRD13487】【共享集群】集群工具ycsctl支持启停节点，启停资源，以及查询拓扑状态测试设计-十、测试环境说明)  
-   [十一、测试版本](#id-【YDBRD13487】【共享集群】集群工具ycsctl支持启停节点，启停资源，以及查询拓扑状态测试设计-十一、测试版本)  




# **一、概述**

ycsctl工具支持启动/停止yfs、yasdb，提供查询拓扑状态的功能，且接受并发的查询操作。

开发设计文档：    [共享集群的工具支持并发读设计方案](https://conf.yasdb.com/pages/viewpage.action?pageId=109576508)  

SR链接：    [YDBRD-13487](https://jira.yasdb.com/browse/YDBRD-13487?src=confmacro)    -  【共享集群】启停节点，启停资源，以及查询拓扑状态  完成

# **二、需求分析**

该需求主要是针对ycs客户端工具ycsctl进行以下两方面的测试：

1、对YCS对外提供的命令字接口进行测试：

- a) ycsctl start ycs--启动ycs服务，会同时启动数据库资源
- b) ycsctl stop ycs--停止ycs服务
- c) ycsctl start   **instance**  --启动ycs所管理的实例资源（这个管理的资源  **仅为**  数据库，需要在配置文件中注册是否默认启动）
- d) ycsctl stop   **instance**  --停止ycs所管理的实例资源
- e) ycsctl   status–打印集群topo


2、对并发读写进行测试。  **读写操作说明**  ：1中所描述的a)b)c)d)为写操作，e)为读操作。

|操作|是否成功|备注|
|---|---|---|
|多并发的读|成功|  
|
|写时，多并发的读|成功|  
|
|多并发写的同时多并发的读|读成功，写等待并串行执行|原则上多并发的写，等待进行串行处理，但无法预判前后执行顺序|
|并发数超过10的读/写|报错|  
|


# **三、规格/范围**

1、部署形态：集群。

2、最大并发数限制为10，且为单个YCS客户端范围内的限制。

# **四、约束限制**

1、YCS启动/停止时，会同时启动/停止YFS，可设置是否启动/停止DB，其中，YFS启动/停止，不可独立；DB启动/停止可单独进行，是否随YCS同时启停可通过配置文件中AUTO_START的值来设置。

2、YCSCTL工具依赖YCS服务，必须启动YCS时才可以使用。

# **五、动态视图/配置参数**

|参数名称|参数说明|默认值|取值范围|生效方式|参数类型|备注|
|---|---|---|---|---|---|---|
|AUTO_START|DB是否随YCS启动|ALWAYS|可选项：【ALWAYS, NEVER】|重启生效|--|YCS参数，非DB参数，该配置参数仅在yascs.ini中设置|


# **六、测试设计方法**

## 6.1 对YCSCTL命令行进行测试

针对  **ycsctl start/stop ycs; ycsctl start/stop instance; ycsctl status**  这五个ycs提供的命令字接口从以下几个角度进行验证，主要使用错误推断法和等价类划分法：

1）、命令关键字命名规范；

2）、命令是否在资料中有对应的信息描述；

3）、命令行工具HELP信息中对命令的描述是否清晰、可读性强；

4）、命令基础语法验证；

5）、基础业务场景验证。

6）、命令相关业务场景测试。

其中，1）2）3）4）5）为公共场景测试，6）因命令不同业务不同，作为业务场景测试。

### **6.1.1 公共场景测试：**

|测试场景|有效等价类|无效等价类|备注|测试是否完成|
|---|---|---|---|---|
|命令关键字命名规范|  
|  
|  
|  
|
|命令是否在资料中有对应的信息描述|  
|  
|检查相应文档|  
|
|命令行工具HELP信息中对命令的描述是否清晰准确    
    
    
    
|  
|  
|  
|  
|
|命令基础语法验证,  
|命令字完整且正确|命令字缺失--缺少命令字|  
|  
|
|||命令字错误--命令字单词拼写错误；包含异常字符|  
|  
|
||命令字之间有多余空格|命令字内部有空格|  
|  
|
|基础业务场景验证|~~ycs正常运行时执行命令~~|ycs未启动时执行|这里只需要关注异常；”ycsctl start ycs“不涉及这部分；ycs服务依赖|  
|


### **6.1.2 业务场景测试：**

|序号|命令行|业务测试场景|具体测试场景描述|预期|备注|是否测试完成|
|---|---|---|---|---|---|---|
|1|ycsctl start ycs|节点数|单节点环境，在YCS未启动时执行命令|命令执行成功，YCS、YFS和DB正常启动|  
|  
|
|2|  
|  
|三节点环境，在YCS未启动时依次执行命令|命令执行成功，多节点YCS、YFS和DB正常启动|  
|  
|
|3|  
|AUTO_START参数|~~AUTO_START不设置时，执行命令~~|命令执行成功，YCS、YFS和DB启动|用例已覆盖缺省用例，不重复测试|  
|
|4|  
|  
|AUTO_START设置为ALWAYS时，执行命令|命令执行成功，YCS、YFS和DB启动|  
|  
|
|5|  
|  
|AUTO_START设置为NEVER时，执行命令|命令执行成功，YCS、YFS启动，DB不启动|  
|  
|
|6|  
|重复执行|YCS正常运行时，执行命令|命令执行报错，“地址占用”|此处只验证重复执行时的场景，并发多次执行在并发场景验证|  
|
|7|ycsctl stop ycs|节点数|单节点环境，在YCS运行时执行命令|命令执行成功，YCS、YFS和DB正常停止|  
|  
|
|8|  
|  
|三节点环境，在YCS运行时依次执行命令|命令执行成功，多节点YCS、YFS和DB正常停止|  
|  
|
|9|  
|重复执行|YCS已经停止后，执行命令|命令执行报错，连接失败|此处只验证重复执行时的场景，并发多次执行在并发场景验证|  
|
|10|ycsctl start instance|节点数|单节点环境，在YCS启动、DB未启动时执行命令|DB可正常启动|可用配置文件控制DB是否启动|  
|
|11|  
|  
|三节点环境，在YCS启动、DB未启动时依次执行命令|多节点DB可正常启动|  
|  
|
|12|  
|重复执行|YCS和DB正常运行时，执行该命令|命令执行报错，“DB已经启动”|  
|  
|
|13|ycsctl stop instance|节点数|单节点环境，在DB运行时执行命令|命令执行成功，DB正常停止|  
|  
|
|14|  
|  
|三节点环境，在DB运行时依次执行命令|命令执行成功，多节点DB正常停止|  
|  
|
|15|  
|重复执行|DB未运行时，执行命令|命令执行报错，“DB已经停止”|  
|  
|
|16|ycsctl status|age字段|首次启动时|Topo ver:2, age:2|  
|  
|
|17|  
|  
|三节点环境，停单个instance，恢复|topo变化，age不变|  
|  
|
|18|  
|  
|三节点环境，停两个instance（包括同一个停两次），恢复|  
|  
|  
|
|19|  
|  
|三节点环境，停三个instance，恢复|  
|  
|  
|
|20|  
|  
|三节点环境，停一备ycs，恢复备ycs|topo变化，age也变|  
|  
|
|21|  
|  
|三节点环境，停两备ycs，恢复备ycs|  
|  
|  
|
|22|  
|  
|三节点环境，停主ycs，恢复主ycs|  
|  
|  
|
|23|  
|  
|三节点环境，停备，停主，恢复主，恢复备|  
|  
|  
|
|24|  
|  
|三节点环境，停主，停二备，恢复主，恢复两备|  
|  
|  
|
|25|  
|self node id字段|三节点环境，运行该命令，查看该字段|显示各节点node id|  
|  
|
|26|  
|cluster master id字段|单节点，ycs主在节点0启动|cluster master id:0|  
|  
|
|27|  
|  
|两节点环境，ycs主在节点0启动，备在节点1启动，ycs0退出；ycs0恢复|cluster master id:0->1->1|  
|  
|
|28|  
|  
|三节点环境，ycs主在节点0启动，备为1、2节点，ycs0退出；ycs1退出；ycs0恢复，ycs1恢复。|cluster master id:0->1->2|  
|  
|
|29|  
|yfs master id字段|单节点，ycs主在节点0启动|yfs master id:0|  
|  
|
|30|  
|  
|两节点环境，ycs主在节点0启动，备在节点1启动，ycs0退出；ycs0恢复|yfs master id:0->1->1|  
|  
|
|31|  
|  
|三节点环境，ycs主在节点0启动，备为1、2节点，ycs0退出；ycs1退出；ycs0恢复，ycs1恢复。|yfs master id:0->1->2|  
|  
|
|32|  
|yasdb master id字段|单节点，YCS和DB都在节点0启动|yasdb master id:0|  
|  
|
|33|  
|  
|两节点环境，DB主在节点0启动，备在节点1启动，DB0退出；DB0恢复|yasdb master id:0->1|  
|  
|
|34|  
|  
|三节点环境，DB主在节点0启动，备为1、2节点，DB0退出；DB1退出；DB0恢复，DB1恢复。|yasdb master id:0->1->2|  
|  
|
|35|  
|active node count字段|单节点运行ycs|active node count:1|  
|  
|
|36|  
|  
|两节点运行ycs|active node count:2|  
|  
|
|37|  
|  
|三节点运行ycs|active node count:3|  
|  
|
|38|  
|Node X状态字段|三节点运行YCS|Node0: online ,Node1: online ,Node2: online|  
|  
|
|39|  
|  
|三节点，停掉停ycs2,起ycs2；停ycs1，起ycs1; ycs0, 起ycs0|Node0: online->offline->online ,Node1: online->offline->online ,Node2: online->offline->online |当前节点YCS服务不可用时，到其他节点运行该命令|  
|
|40|  
|target状态字段|AUTO_START设置为ALWAYS时，执行命令|节点target为online|  
|  
|
|41|  
|  
|AUTO_START设置为NEVER时，执行命令|节点target为offline|  
|  
|
|42|  
|  
|不设置AUTO_START时|节点target为online|  
|  
|
|43|  
|yasfs状态字段|三节点运行YCS|Node0 yasfs: online ,Node1 yasfs: online ,Node2 yasfs: online|  
|  
|
|44|  
|  
|三节点，停掉停ycs2,起ycs2；停ycs1，起ycs1; ycs0, 起ycs0|Node0 yasfs: online->offline->online ,Node1  yasfs: online->offline->online ,Node2 yasfs: online->offline->online |随YCS状态变化是否正常|  
|
|45|  
|yasdb状态字段|三节点运行YCS和DB|Node0 yasdb: online ,Node1 yasdb: online ,Node2 yasdb: online|  
|  
|
|46|  
|  
|三节点正常YCS和DB，停db2,起db2；停db1，起db1; 停掉db0, 起db0|Node0 yasdb: online->offline->online ,Node1 yasdb: online->offline->online ,Node2 yasdb: online->offline->online |主要看状态是否能正常变化|  
|
|47|  
|yasdb inter url字段|三节点运行YCS和DB|各该字段与配置文件yasdb.ini中一致|  
|  
|
|48|  
|  
|三节点运行YCS和DB，停db2,起db2；停db1，起db1; 停掉db0, 起db0|只显示在线DB的yasdb inter url, 且与配置文件中一致|不仅关注显示与否，且须注意与配置文件的比对|  
|


## 6.2 对并发读写进行测试

针对并发读写，主要根据边界值法和场景法进行设计（单一操作以及YCS未正常运行时的操作6.1部分已经涉及，不再重复，本部分着重测试多并发读写）

6.2.1 这部分为单个节点内测试 (  写操作串行顺序无法预判）

|序号|读写并发总数|场景|读写场景设计|具体场景安排|预期结果|备注|测试是否完成|
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
|1|中间值5|多并发读|读读读读读|同时下发5个“ycsctl status”命令查询集群拓扑信息|都成功查询到集群拓扑信息|  
|  
|
|2|  
|写时多并发读|写读读读读|下发“ycsctl stop ycs”的同时下发4个“ycsctl status”查询集群拓扑信息|四个查询拓扑信息命令即刻返回；ycs停止|  
|  
|
|3|  
|多并发写时多并发读|写读读写读|同时下发三个ycsctl status；以及ycsctl start ycs; ycsctl stop ycs|三个查询拓扑信息命令即刻成功；其他操作串行执行|多写串行，原则上不能预判先后|  
|
|4|  
|  
|写读读写读|同时下发三个ycsctl status；以及ycsctl stop instance; ycsctl stop ycs|三个查询拓扑信息命令即刻成功；其他操作串行执行|  
|  
|
|5|  
|  
|写读写写读|同时下发两个ycsctl status；以及ycsctl stop instance; ycsctl start instance; ycsctl stop ycs|两个查询拓扑信息命令即刻成功；其他操作串行执行|  
|  
|
|6|最大值10|多并发读|读读读读读读读读读读|同时下发10个“ycsctl status”命令查询集群拓扑信息|都成功查询到集群拓扑信息|  
|  
|
|7|  
|写时多并发读|写读读读读读读读读读|下发“ycsctl stop instance”的同时下发9个“ycsctl status”查询集群拓扑信息|9个查询拓扑信息命令即刻返回；DB停止|  
|  
|
|8|  
|多并发写时多并发读|写读读写写读写读写读|同时下发5个读命令ycsctl status；以及ycsctl stop ycs; ycsctl start ycs;ycsctl stop instance; ycsctl start instance; ycsctl stop instance|查询拓扑信息命令即刻成功；其他操作串行执行|理论上停YCS不会影响同时下发的查询拓扑信息命令|  
|
|9|  
|  
|写读读写读读读读读读|同时下发8个ycsctl status；以及ycsctl start ycs; ycsctl start instance|查询拓扑信息命令即刻成功；其他操作串行执行|  
|  
|
|10|  
|  
|写读读写读读写读读读|同时下发7个ycsctl status；以及ycsctl start ycs; ycsctl stop ycs; ycs start instance|查询拓扑信息命令即刻成功；其他操作串行执行|  
|  
|
|11|边界值9|多并发读|读读读读读读读读读|同时下发9个“ycsctl status”命令查询集群拓扑信息|都成功查询到集群拓扑信息|  
|  
|
|12|  
|写时多并发读|写读读读读读读读读|instance未运行时，下发“ycsctl start instance”的同时下发8个“ycsctl status”查询集群拓扑信息|8个查询拓扑信息命令即刻返回；DB启动|  
|  
|
|13|  
|多并发写时多并发读|读读写写读读写写读|同时下发5个ycsctl status;以及 ycsctl start ycs; ycsctl start ycs; ycsctl start ycs; ycsctl start ycs; |查询拓扑命令即刻返回；其他操作串行执行|  
|  
|
|14|  
|  
|写读读读读读读读写|同时下发7个ycsctl status；以及ycsctl start ycs; ycsctl stop instance|查询拓扑信息命令即刻成功；其他操作串行执行|  
|  
|
|15|  
|  
|写读读写读读读读写|同时下发6个ycsctl status；以及ycsctl start ycs; ycsctl stop ycs; ycs stop instance|查询拓扑信息命令即刻成功；其他操作串行执行|  
|  
|
|16|边界值11|多并发读|读读读读读读读读读读读|同时下发11个“ycsctl status”命令查询集群拓扑信息|10个命令成功查询到集群拓扑信息，1个返回失败，超过并发数|  
|  
|
|17|  
|写时多并发读|写读读读读读读读读读读|ycs正常运行时，下发“ycsctl start ycs”的同时下发10个“ycsctl status”查询集群拓扑信息|**1个操作超过并发，其他操作：**  查询拓扑命令即可返回；ycs启动失败（已经在运行，地址占用）|这里无法预判哪个操作超过并发|  
|
|18|  
|多并发写时多并发读|写读读读写读读写读读写|同时下发7个ycsctl status命令 ycsctl stop ycs;  ycsctl start ycs; ycsctl start instance; ycsctl stop instance|**1个操作超过并发，其他：**  查询拓扑命令即刻返回；其他写命令串行执行|  
|  
|
|19|  
|  
|写写读读读读读读读读读|同时下发9个ycsctl status；以及ycsctl stop ycs; ycsctl start instance|**1个操作超过并发，其他：**  查询拓扑命令即刻返回；写命令串行执行|  
|  
|
|20|  
|  
|写读读写读读读写读读读|同时下发8个ycsctl status；以及ycsctl start ycs; ycsctl start instance; ycsctl stop instance|**1个操作超过并发，其他：**  查询拓扑命令即刻返回；写命令串行执行|  
|  
|


6.2.2 多节点之间并发是否影响，此处主要测三节点

|序号|多节点并发总数|各节点并发数|各节点并发操作场景|具体场景安排|预期结果|备注|测试是否完成|
|---|---|---|---|---|---|---|---|
|1|9    
    
|node0:3|读读读|node0同时下发3个“ycsctl status”命令查询集群拓扑信息|**三节点操作互不干扰，操作均能成功：**  三个节点查询集群拓扑信息的命令即刻返回；其他写操作串行执行|  
    
    
|  
    
|
|||node1:4|写读写读|node1同时下发2个ycsctl status命令和ycsctl stop instance; ycsctl start instance||||
|||node2:2|写读|node2同时下发ycsctl stop ycs; ycsctl status||||
|2|10|node0:3|写读读|node0同时下发两个查询拓扑信息命令和ycsctl start ycs|**三节点操作互不干扰，操作均能成功：**  三个节点查询集群拓扑信息的命令即刻返回；其他写操作串行执行,  
|  
|  
|
|||node1:4|读读写写|node1同时下发两个查询命令以及ycsctl stop ycs;ycsctl stop ycs||||
|||node2:2|读读|node2同时下发两个查询命令||||
|3|30    
    
|node0:10|读读写写读读写写读|node0同时下发5个查询集群拓扑信息命令和ycsctl stop instance; ycsctl start instance; ycsctl start instance; ycsctl start instance|**三节点操作互不干扰，node0和node1均能执行所有操作，node2一个操作返回超过并发：**  三个节点查询集群拓扑信息的命令即刻返回；其他写操作串行执行|  
|  
|
|||node1:9|写读读读读读读读|node1同时下发8个查询集群拓扑信息命令和ycsctl stop ycs||||
|||node2:11|写读读读写读读写读读写|node2同时下发7个查询集群拓扑信息命令和ycsctl stop instance; ycsctl stop instance; ycsctl stop instance; ycsctl stop instance;||||
|4|36|node0:11|写读读读读读读读读读读|node0同时下发10个查询集群拓扑信息命令和ycsctl stop instance|**三节点操作互不干扰，node0一个操作超过并发，node1两个操作超过并发，node3三个操作返回超过并发：**  并发数内的查询命令即刻返回，其他写操作串行执行|  
|  
|
|||node1:12|写写读读写写读写读读写读|node1同时下发6个查询集群拓扑信息命令，以及ycsctl stop instance; ycsctl stop ycs;ycsctl start ycs; ycsctl start instance; ycsctl stop instance; ycsctl start ycs||||
|||node3:13|读读读读读读读读读读读读读|node2同时下发13个读||||


# **七、详细测试设计**

[YDBRD-13487 ycsctl工具.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YmM4OTcwYzJhZjRmNTFmYTNkIiwicmVmX2lkIjoiNjczOTY5YmI3MjgyMDZlZmI5MmVmNmMyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NjE4LCJleHAiOjE3ODIyOTUwMTh9.awo_LUrH4ki-voUQxuPvIj0gNQ8YrrBHAAA8XuYabVk)

# **八、测试用例**

[YDBRD-13487 ycsctl工具_测试用例module_V1.0.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YmM4OTcwYzJhZjRmNTFmYTNlIiwicmVmX2lkIjoiNjczOTY5YmI3MjgyMDZlZmI5MmVmNmMyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NjE4LCJleHAiOjE3ODIyOTUwMTh9.OA3rbwDKjADv16q3ecPSkVZfeSZOrJvpQlU82sMIO64)

# **九、测试框架/测试用例自动化**

# **十、测试环境说明**

集群最大节点数：三节点；

存储：磁阵及模拟器交叉测试

# **十一、测试版本**

  


## Attachments:

[YDBRD-13487 ycsctl工具_测试用例module_V1.0.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YmM4OTcwYzJhZjRmNTFmYTNlIiwicmVmX2lkIjoiNjczOTY5YmI3MjgyMDZlZmI5MmVmNmMyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NjE4LCJleHAiOjE3ODIyOTUwMTh9.OA3rbwDKjADv16q3ecPSkVZfeSZOrJvpQlU82sMIO64)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-13487 ycsctl工具.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YmM4OTcwYzJhZjRmNTFmYTNkIiwicmVmX2lkIjoiNjczOTY5YmI3MjgyMDZlZmI5MmVmNmMyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NjE4LCJleHAiOjE3ODIyOTUwMTh9.awo_LUrH4ki-voUQxuPvIj0gNQ8YrrBHAAA8XuYabVk)

 (application/x-xmind)    


## Comments:

|  [](null)  ,评审会议记录：,1、ycs参数不会在yasql中呈现，不支持设置；,2、ycsctl相应命令文档会一起交付；,3、topo version版本不再对外呈现，age变更跟原来一致，集群重新配置时，需初始化，这部分需要提单跟踪；,4、单独启停DB这部分功能止步于DB能启动/停止，运行命令后状态在topo中能在online/offline状态切换，业务是否能正常处理本SR不交付。,Posted by xufanbo at 五月 12, 2023 15:15|
|---|
|  [](null)  ,测试的时候，需要注意并发的制造方法，很难保证真正达到预想的并发数。,Posted by xufanbo at 五月 12, 2023 15:52|
|  [](null)  ,2023.06.12对齐：,目前ycsctl start/stop instance只是替换了ycsctl start/stop resources，资源内部逻辑未变，因此AUTO_START也是控制了YFS和DB，本SR相对原master没有变更。,Posted by xufanbo at 六月 12, 2023 16:55|
|  [](null)  ,ycsctl status命令执行很快，若想压满并发，需超过10个并发下发，才能达到同时有10个命令处理导致超出并发数。,Posted by xufanbo at 六月 13, 2023 15:06|
