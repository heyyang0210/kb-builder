Created by 徐凡博, last modified on 九月 11, 2024

# 1. 概述

本文描述共享集群  YCS的voting disk和ycr disk支持多盘的测试设计。

SR:      [https://pingcode.yasdb.com/pjm/items/6611a8b7579a3edb84d860f1](https://pingcode.yasdb.com/pjm/items/6611a8b7579a3edb84d860f1)    *?*    
  *#YDBRD-25870 YCS支持多盘——YCS*

开发设计文档：    [【YCS】ycs多盘详细设计文档](150629086.html)  

测试概要设计：    [YASHAN-305 【YCS支持多盘，支持YFS管理YCS数据】--测试概要设计](153000748.html)  

# 2. 需求分析

## 2.1 功能点分析

### 2.1.1 影响场景梳理

本需求是将多盘放入yfs管理，利用YFS的冗余和条带化，方便系统演进并提升系统的稳定性。

因此，新需求影响的场景包含：

|  
|主线|场景描述|变更点/新预期|备注|
|---|---|---|---|---|
|1|部署前|环境变更|根据副本数量，准备磁盘副本数有1，3，5；磁盘数量对应需1+1, 3+1, 5+1|此处需要考虑CI环境怎么调整，是修改部分工程配置，还是所有集群环境均选择3+1；  测试副本的场景单独要有三种环境，需要三个工程对应  原裸盘方案不再支持|
|2|部署及启动|单机模式启动YFS|新增命令 yasfs -D $YASCS_HOME|  
|
|3|  
|YFS建system diskgroup|1、新增命令：yfscmd exec create system diskgroup扩展命令：yfscmd show dg 新增显示 dg 类型列2、冗余度与磁盘数目相关，创建时会有约束限制：,- external 1
- normal  3
- high      5
,3、system diskgroup 约束限制：1）在单机模式与普通dg操作权限一致2）system dg创建时需满足冗余和disk数量约束符合设计 –> 不符合在命令级别有拦截3）集群模式下，system dg只能进行文件IO、ls等读操作，其他操作应报错。|systemDG的文件读写失败，开发能否提供故障点，主要看一下YCS的拦截。|
|4|  
|初始化YCS配置|创建指定文件（非新增命令，仅扩展功能）yfscmd -D /home/mayong/YASDB_NODE/node0 touch +SYSTEM/voting    
  yfscmd -D /home/mayong/YASDB_NODE/node0 touch +SYSTEM/ycr    
  yfscmd -D /home/mayong/YASDB_NODE/node0 truncate -q -s 100M +SYSTEM/voting    
  yfscmd -D /home/mayong/YASDB_NODE/node0 truncate -q -s 100M +SYSTEM/ycr    
  涉及YFS扩展命令测试：1) yfscmd touch 新增文件类型参数 -t   文件名建议： voting，ycr，通过 -t 指定类型：1：YCR，2：VOTING  eg.    yfscmd touch -t 1   "+system/ycr"  ;|  
|
|5|  
|ycr、ycs获取ycs、ycr文件名称的能力|用于配置ycr、启动ycs之前，有配置项的新增  1、支持默认名称，可以不配置文件名称；2、yascs.ini新增配置项     **YCR_FILE_NAME**  ，     **VOTING_FILE_NAME**  ，用于配置voting file和ycr file名称|  
|
|6|  
|创建集群|命令变更ycsctl create cluster|  
|
|7|停止|停止YFS实例|命令   yfscmd   exec   shutdown abort;|运行时，需拦截|
|8|  
|停止YCS|停止yfs时，保留ycs、ycr文件的读写能力，待ycs停止后，yfs再完全停止|~~此部分涉及阶段性失败，需提供白盒测试手段。 ~~  白盒只能给hang|
|9|运行时|多盘状态展示|新增命令 ycsctl query disk|  
|
|10|故障|YCS异常停止后，对ycs、ycr文件的影响|1、进程异常后，重启观察2、白盒注入阶段性异常后，重启观察|  
|
|11|  
|副本被破坏|破坏时机：,1、启动前破坏,2、运行中破坏,3、选举中破坏（这个需要卡时间点）-- 可考虑构造磁盘故障或者进程故障，切主过程中破坏副本,破坏粒度：,1、磁盘级别：整盘DD、   盘不可访问（存储网段断连）、  ~~存储端断映射（无权限操作）~~  、运行时软连接删除、开发提供读写失败埋点等）,2、副本级别破坏 （cin指令）,3、小于副本级别（部分字段）,破坏 （ycsdump工具）副本数量：主要三副本、五副本。,副本异常观察：,1、数据可以查看被破坏,2、日志可以查看副本恢复 grep [YFS REPAIR YCS] 以上需根据时机和类型，结合ycsdump工具使用。|1、可正确读取副本数据2、不可正常读取副本数据时，错误能拦截|
|12|  
|网络故障|包括：通信网络故障、存储网络故障1、ycs间通信网络故障，备有探主流程，会读写ycs文件2、存储网络故障，原则上与所有副本无效一致。|  
|
|13|  
|磁盘心跳故障|1、主节点，覆盖探活，切主流程（读写文件）2、备节点，覆盖查主流程（读写文件）3、磁盘故障原则与副本|  
|
|14|工具|ycsdump工具|1、展示数据功能保留2、原有写坏冗余区、非冗余区功能删除。|1、需利用ycsdump工具进行ycr/voting file数据破坏副本的用例。2、根据当前ycsdump工具功能考虑现有用例是否仍然适用。|


### 2.2.2 测试角度分析

由2.2.1分析的功能场景梳理，本需求涉及YFS、YCS两个模块，可识别出的测试角度分为以下几种：

**1）**  **命令行测试**  ：新增命令行、扩展命令字

新增命令：

i）  yfscmd create system diskgroup SYSTEM     – 非公开命令

使用示例：yfscmd create system diskgroup SYSTEM normal redundancy disk   '/dev/yfs/sdb'   disk   '/dev/yfs/sdc'   disk   '/dev/yfs/sdd'  ;

ii）ycsctl query disk

调整命令：

i）yfscmd touch 新增文件类型 -t      – 非公开命令

ii)  yfscmd show dg新增显示dg类型列

**2）新增文件配置项测试**

|  
|参数|修改方式|备注|
|---|---|---|---|
|1|YCR_FILE_NAME|仅限文件修改，重启生效|实际一旦设定无法修改为其他值？取决于约束限制的严格程度？|
|2|VOTING_FILE_NAME|仅限文件修改，重启生效|  
|


**3）system DG权限测试**

**4）启停功能：**

- **YFS单机模式启、停**
- **YCS分阶段停止**
- **并发启停**


**5）副本功能：**

- **ycr、ycs文件读写，查看**
- **ycs盘查看功能**
- **副本破坏测试（含ycsdump工具使用）：**  一半以上数据正常可正确读写；否则数据无效
- **副本破坏后恢复**


**6）强相关故障场景：**

- **进程异常停止（要求可重入）**
- **网络故障：通信、存储**
- **磁盘心跳故障**


### 2.2 应用场景

本特性涉及到集群的部署、启停、故障等多重场景。

作为其他SR的基础：

1）    [https://pingcode.yasdb.com/pjm/items/6611a8ba579a3edb84d860f9](https://pingcode.yasdb.com/pjm/items/6611a8ba579a3edb84d860f9)    ?    
  #YDBRD-25871 YCS支持多盘——OM

2）    [https://pingcode.yasdb.com/pjm/items/662f3aedc36a3d30a85fc9d2](https://pingcode.yasdb.com/pjm/items/662f3aedc36a3d30a85fc9d2)    ?    
  #YDBRD-26777 YCS支持单盘升级到多盘

## 2.3 规格约束

**1）规格：**

- 部署形态：集群
- 节点数目：原则上与节点数无关，  dev分支（四节点故障未回合，是否考虑两节点转测）


**2）测试约束：**

- 不兼容原来的裸盘模式
- 支持三种冗余度，分别是外部冗余，普通冗余和高冗余。配置一块磁盘，属于外部冗余，建议选择自身可以实提供冗余保护的硬件设备。普通冗余支持配置3块磁盘，高冗余支持配置5块磁盘。其他数量的磁盘不支持。
- (VF盘数/2 )+ 1 或者以上的数量的表决盘损坏时，集群启动失败
- 暂时不支持动态增加或者删除表决盘
- 部署时不支持并发
- system diskgroup 仅允许在 单机模式创建、修改、删除，集群模式下仅允许读写其中的文件，读目录、文件、dg 属性，不允许任何操作变更system diskgroup的元数据。由于 system diskgroup 在集群下不允许变更元数据，因此 ycs 启动时，yfs 允许对 system dg 的并发访问没有任何限制，ycs  可以并发启动。yfs 不限制 system dg 的数量。但是 ycs 启动至少需要 1 个 system dg。


# 3. 详细测试设计

## 3.1 测试设计方法

本需求主要采用等价类划分法、场景法、状态转换法、错误推断法、正交组合法等测试方法进行设计。

## 3.2 详细测试设计

本部分测试侧重新功能设计与实现，系统已有的相关功能（并发启停、故障等）要求不劣化，这部分已有CI维护，仅作简单测试，测试过程中可通过复制工程检验。

### **3.2.1  命令行测试**

**3.2.1.1 新增命令**  **涉及的公共场景测试项：-- done**

涉及命令包含：

i）  yfscmd create system diskgroup SYSTEM   – 非公开

ii）ycsctl query disk

iii）yfscmd touch 新增文件类型 -t  --非公开

iv)  yfscmd show dg新增显示dg类型列

|测试场景|有效等价类|无效等价类|备注|
|---|---|---|---|
|关键字命名规范|  
|  
|  
|
|命令在资料中的描述|  
|  
|  
|
|命令在HELP信息中的描述|  
|  
|  
|
|命令输入语法验证|命令字完整且正确|命令字缺失--缺少命令字|正确输入后，正常返回或者正确呈现符合设计信息；异常输入后，友好提示。|
|  
|  
|命令字错误--命令字单词拼写错误；包含异常字符|  
|
|  
|命令字之间有多余空格|命令字内部有空格|  
|
|  
|参数值在指定选项内|参数值在选项外|1、创建DG时的冗余度2、touch的file类型|
|yfscmd命令依赖项验证|yfscmd命令单机启动yfs|不启动yfs|所有yfscmd命令均无效|
|  
|  
|完整启动yfs|create system DG无效|
|ycsctl命令依赖项验证|ycs未启动|ycs启动|query disk依赖，ycs未启动时无法使用|


**3.2.1.2 命令与特定场景**

**1）yfscmd create system diskgroup SYSTEM的冗余度和磁盘存在相关性，需做相关测试。**  手动测试，非公开命令，暂不自动化。  – done

i) 磁盘冗余度相关性  

|冗余度|有效等价类|无效等价类|备注|
|---|---|---|---|
|external|输入1个disk|不输入disk|YAS-05581   invalid operation to system diskgroup: valid failgroup count for system diskgroup redundancy are 1 failgroup for external, 3 failgroups for normal, 5 failgroups for high|
|  
|  
|输入2个disk|同上|
|normal|输入3个disk|不输入disk|同上|
|  
|  
|输入2个disk|同上|
|  
|  
|输入4个disk|同上|
|high|输入5个disk|不输入disk|同上|
|  
|  
|输入4个disk|同上|
|  
|  
|输入6个disk|同上|


ii）输入磁盘路径的有效性

|  
|有效等价类|无效等价类|备注|测试结果|
|---|---|---|---|---|
|输入磁盘路径验证|输入存在且有效的磁盘|输入不存在的盘|  
|无效合理提示|
|  
|输入未创建软链接的磁盘|  
|dev最新可支持|可以创建system DG|


**2）ycsctl query disk 相关功能测试 --todo**

|  
|有效等价类|无效等价类|备注|
|---|---|---|---|
|查询磁盘|运行中，磁盘正常|运行中磁盘软连接删除|软连接删除可能不会影响|


### **3.2.2  新增配置参数测试 **

**针对两个yascs.ini中的新增参数：**  YCR_FILE_NAME、VOTING_FILE_NAME – done&auto

|有效等价类|无效等价类|备注|测试结果|
|---|---|---|---|
|设置为创建文件名相同的值|设置未非创建的文件名|  
|  
|
|  
|设置参数值为NULL，空|  
|为空或者NULL时，有默认值，不会报错|
|  
|设置为错误值（不带+），乱码|  
|  
|
|不设置（默认与创建相同）|不设置（默认与创建不同）|  
|  
|
|正确设置一次|正确设置多次|  
|  
|
|  
|正确设置一次，多次错误设置|  
|  
|
|资料补充|  
|  
|  
|


补充场景：--done&auto

1、创建时，创建文件名为非默认的值，然后配置文件中不设置，观察报错  – file/directory ycr does not exist.   file/directory voting does not exist. 新增错误码YAS-05522  YAS-05712

2、创建时，多创建一个文件，中途改配置为这个文件，看是否报错；多创建一个文件（非默认），然后使用这个创建集群，中间改成默认值。  – YDBRD-30043  

### **3.2.3 system DG权限测试**

本部分主要验证访问约束符合预期，且约束外的操作需做合理提示和拦截。

|YFS启动模式|操作|测试预期|测试结果|备注|
|---|---|---|---|---|
|单机模式|创建system DG|可创建|可创建|  
|
|  
|查看system DG|可查看|可查看|  
|
|  
|删除system DG|可删除|可删除|非空不能删，清空后可删|
|  
|创建文件后，读system DG中的文件|可读|可读|cat，ls --可|
|  
|创建文件后，写system DG中的文件|可写|可写|mv, mkdir, cp  --可,echo重定向echo "hello world" | yfscmd cin DG/file/name  --可|
|  
|创建文件后，删除文件|可删除|可以删除|rm|
|集群模式|创建system DG|不可创建|不可创建|cannot create system diskgroup in cluster mode|
|  
|查看system DG|可查看|可查看|  
|
|  
|删除system DG|不可删除|不可删除|YAS-05534 unsupport operation: Delete diskgroup with rm|
|  
|单机创建文件后，读system DG中的文件|可读|可读|cat，ls|
|  
|单机创建文件后，写system DG中的文件|可写|可写|mv, mkdir, cp（涉及到元数据的变更，不可用） 命令模式下echo重定向echo "hello world" | yfscmd cin DG/file/name （可用）|
|  
|单机创建文件后，删除文件|不可删除|不可删除|rm    “YAS-05581 invalid operation to system diskgroup: meta data read-only in cluster mode”|


### **3.2.4 启停功能**

本部分每个场景均需要在单副本、三副本、五副本三种冗余情况下测试。

|场景|分场景|测试预期|测试结果（单）|测试结果（三）|测试结果（五）|备注|
|---|---|---|---|---|---|---|
|YFS单机模式启停|YFS单机模式启动|可启动|可启动|可启动|可启动|  
|
|  
|YFS单机模式启动后，当前节点shutdown abort停止|可停止|可停止|可停止|可停止|  
|
|  
|YFS单机模式启动后，非当前节点shutdown abort停止|不可停|不可听|不可停|不可停|YFS不具备跨机器互联 Error: Cannot connect to YFS server, is it still alive?|
|YCS启动|集群启动后，主节点shutdown abort停止|不可停止|不可停止|不可停止|不可停止|  
|
|  
|集群启动后，非主节点shutdown abort停止|不可停止|不可停止|不可停止|不可停止|  
|
|YCS分阶段停止|停止过程中，埋点构造YFS停止部分服务失败|返回失败？还是强制停止？|  
|  
|  
|  
|
|  
|停止过程中，埋点构造YCS停止失败|  
|  
|  
|  
|返回失败？还是强制停止？|
|  
|正常停止（后可以正常启动，DG在）|正常，重启DG在|正常|正常|正常|  
|
|并发启停|多节点并发启动ycs|  
|正常|正常|正常|本部分仅作简单测试，CI已有详细用例覆盖,复用已有自动化用例yasft\ha\ha_cluster\testcase\YCS\YcsStartStop\Parallel_StartStop,01 02 05,如果这部分上CI有不同部署，可以考虑复用用例即可。|
|  
|多节点并发停止ycs|  
|正常|正常|正常||
|  
|多节点并发启动和停止ycs|  
|正常|正常|正常||


### 3.2.5  副本测试

3.2.5.1 单副本场景

|场景|分场景|测试时机|观察点|测试预期|测试结果|备注|
|---|---|---|---|---|---|---|
|正常功能|部署集群功能|正常创建DB，配置YCR，拉起ycs|拉起流程|正常|通过|部署脚本覆盖|
|  
|启停功能验证|正常拉起，下发业务，停止ycs|业务中可正常停止|正常|通过|已有用例覆盖（上车）|
|  
|  
|业务中停止ycs， 后拉起， 下发业务|重新拉起后可下发业务，无core|正常|通过|已有用例覆盖（上车）|
|  
|切主流程|kill主节点|切主行为是否正常|正常|通过|复用testcase/fault_test/ycs_fault/iofence_protection/test_sdv_ydbrd_25875_iofence_protection_kill_001.py|
|副本数据破坏|dd整盘数据|创建system DG后，创建文件前|创建文件是否成功|失败|成功或者失败都在预期内|原因是数据缓存在内存中未刷盘，但是如果重启yasfs，就没有+SYSTEM了，创建会失败YAS-05540 diskgroup SYSTEM does not exist|
|  
|  
|创建文件后，配置ycr前|配置ycr是否报错|报错|成功或者失败都在预期内|同上|
|  
|  
|配置完ycr，拉起ycs前|ycs是否能够拉起|拉不起来|拉不起来|YAS-05540 diskgroup SYSTEM does not exist.|
|  
|  
|运行时|ycr数据,topo|运行时，ycr数据可以 查询，但是一旦重启，拉不起来，两个ycs topo都异常|运行时，ycr数据可以 查询，但是一旦重启，拉不起来，两个ycs都异常|  
|
|  
|副本数据破坏（整副本、部分字段两种都测）|配置完ycr后，ycsdump破坏ycr数据副本|拉起ycs过程观察|失败|拉不起来|复现ycsctl core的问题|
|  
|  
|运行时，ycsdump破坏ycr数据副本|业务运行时观察|~~业务有问题~~,业务不受影响|所有进程不会受影响，ycsctl show config会显示”YAS-05532 YFS file block is corrupted“|若观察不到，可使用ycsctl show config命令,除了重启流程会访问ycr，正常运行不会|
|  
|  
|运行时，ycsdump破坏voting file副本|业务正常运行中，破坏主节点数据|业务有问题|符合预期|业务立马终止，备节点topo一段时间下线|
|  
|  
|  
|业务正常运行中，破坏备节点数据|  
|符合预期|一段时间后主节点查到备节点topo下线,备节点服务不可用|
|  
|  
|  
|业务运行中，破坏主备节点数据|  
|符合预期|业务停止，两个节点服务都不可用|
|  
|  
|  
|网络故障后破坏主节点的信息|切主|  
|只写坏主的voting，然后ycr盘正常，故障清除后主自杀后被拉起，加入节点2，最终两个节点都是online|
|  
|  
|  
|网络故障后破坏备节点的信息|  
|  
|有问题    [待确认问题 -- 2024.7.10](https://conf.yasdb.com/pages/viewpage.action?pageId=159425944)  |
|  
|  
|  
|网络故障后破坏所有节点的信息|  
|  
|还是切主了，怀疑跟上面一个问题相关|
|  
|  
|运行时，cin破坏ycr的唯一副本|业务正常运行中|同写坏一样|系统正常运行无影响，但是无法重启|dd if=/dev/urandom bs=1M count=1 | yfscmd -D $YASCS_HOME cin -s 0 -c 0 +SYSTEM/ycr|
|  
|  
|运行时, cin破坏voting的唯一副本|网络故障后破坏1M的数据（offset=0）|两个节点都下线|两个节点都下线；网络恢复了也没用，恢复不了了|dd if=/dev/urandom bs=1M count=1 | yfscmd -D $YASCS_HOME cin -s 0 -c 0 +SYSTEM/voting,DEBUG][errno=05532]: YFS file block is corrupted, diskgroup: SYSTEM, fd: 256, block type: 0, block id: 58 [yfsi_interface.c:1001]|
|  
|  
|  
|网络故障后破坏2k的数据(offset=0)|  
|  
|开发确认中    [待确认问题 -- 2024.7.10](https://conf.yasdb.com/pages/viewpage.action?pageId=159425944)  |
|  
|  
|  
|网络故障后破坏6k的数据(offset=0)|  
|  
|date;dd if=/dev/urandom bs=1024 count=6 | yfscmd -D $YASCS_HOME cin -s 0 -c 0 +SYSTEM/voting|
|  
|  
|  
|cin使用随机数破坏1k|主节点不可用，切主|符合预期|  
|
|  
|  
|  
|cin使用随机数破坏4k|业务终止，切主|符合预期|  
|
|  
|  
|  
|cin使用随机数破坏6k|业务有问题，两个节点进程都不可用|符合预期|  
|


3.2.5.2 三副本场景

|  
|场景|分场景|测试时机|观察点|测试预期|测试结果|备注|
|---|---|---|---|---|---|---|---|
|1|正常功能|部署集群功能|正常创建DB，配置YCR，拉起ycs|拉起流程|正常|通过|  
|
|2|  
|启停功能验证|正常拉起，下发业务，停止ycs|业务中可正常停止|正常|通过|  
|
|3|  
|  
|业务中停止ycs， 后拉起， 下发业务|重新拉起后可下发业务，无core|正常|通过|  
|
|4|  
|切主流程|kill主节点|切主行为是否正常|正常|通过|  
|
|5|破坏一份副本数据|dd整一个盘数据|创建system DG后，创建文件前|创建文件是否成功|  
|在线可成功创建文件（内存操作）,重启yasfs后system DG is broken;创建文件失败|行为不可确定，有可能拉不起来|
|6|  
|  
|创建文件后，配置ycr前|配置ycr是否报错|  
|在线可成功配置（内存操作）,重启yasfs后，ycr无法配置|YAS-05538 diskgroup SYSTEM is offline.,broken|
|7|  
|  
|配置完ycr，拉起ycs前|ycs是否能够拉起|  
|符合预期|无法拉起,YAS-05538 diskgroup SYSTEM is offline.,  
|
|8|  
|  
|运行时|ycr数据,topo|运行时，ycr数据可以 查询，但是一旦重启，拉不起来,topo没影响|运行时，ycr数据可以 查询，但是一旦重启，拉不起来|systemDG会dismount|
|9|  
|一份副本数据破坏（ycsdump）|配置完ycr后，ycsdump破坏一份ycr数据|拉起ycs过程观察|成功|符合预期|  
|
|10|  
|  
|运行时，ycsdump破坏一份ycr数据|业务运行时观察,重新拉起|业务无问题,可重启|符合预期|  
|
|11|  
|  
|业务正常运行中，ycsdump破坏主节点voting file|观察是否正常运行|业务无问题,topo没问题|符合预期|  
|
|12|  
|  
|业务正常运行中，ycsdump破坏备节点voting file|观察是否正常运行|业务无问题,topo没问题|符合预期|  
|
|13|  
|  
|网络故障并行，ycsdump破坏主节点voting file|观察切主是否正常执行|切主|符合预期|ycsdump ycs set -o 0 -c 0|
|14|  
|  
|网络故障并行，ycsdump破坏备节点voting file|  
|备下线，恢复后上线|符合预期|  
|
|15|  
|  
|切主过程中（网络故障并行），ycsdump破坏主备节点voting file|  
|  
|  
|  
|
|16|  
|一份副本数据破坏（cin）|配置完ycr后，cin破坏1k数据|  
|可以拉起|符合预期|  
|
|17|  
|  
|运行时，ycsmdump破坏512BYTE ycr数据|  
|业务无影响,topo没变化,可重新拉起|符合预期|dd if=/dev/urandom bs=512 count=1 | yfscmd -D $YASCS_HOME cin -s 0 -c 0 +SYSTEM/ycr|
|18|  
|  
|业务正常运行中，cin从offset=0破坏3k数据|  
|业务无影响,topo没变化|符合预期|  
|
|19|  
|  
|业务正常运行中，cin从offset=4096破坏2k数据|  
|业务无影响,topo没变化|符合预期|  
|
|20|  
|  
|业务正常运行中，cin从offset=0破坏6k数据|  
|业务无影响,topo没变化|符合预期|  
|
|21|  
|  
|切主过程中（网络故障并行），cin从offset=0破坏10k数据|  
|  
|  
|  
|
|22|破坏两份副本数据|dd整两个盘数据|创建system DG后，创建文件前|创建文件是否成功|失败|在线可成功创建文件（内存操作）,重启yasfs后system DG is broken;创建文件失败|dd后要重启yasfs才能观察,YAS-05538 diskgroup SYSTEM is offline|
|23|  
|  
|创建文件后，配置ycr前|配置ycr是否报错|报错|在线可成功配置（内存操作）,重启yasfs后，ycr无法配置|未重启前，查询数据disable(全0),重启后，offline，然后system DG BROKEN|
|24|  
|  
|配置完ycr，拉起ycs前|ycs是否能够拉起|拉不起来|符合预期|YAS-05538 diskgroup SYSTEM is offline.|
|25|  
|  
|运行时|ycr数据,topo|ycr数据全0,topo没变化|  
|全0数据目前不做crc校验|
|26|  
|两副本数据破坏（ycsdump)|配置完ycr后，破坏ycr数据（ycsdump）|拉起ycs过程观察|失败|符合预期|yasfs在线时，查询失败|
|27|  
|  
|运行时，破坏ycr数据|业务运行时观察|查询ycr信息失败，重启失败|符合预期|ycsctl show config 显示YFS file block is corrupted,重启起不来|
|28|  
|  
|业务正常运行中，破坏两份主节点voting file|观察是否正常运行|业务有问题，主节点offline|符合预期|ycsdump ycs set -o 0 -c 1;ycsdump ycs set -o 0 -c 0,同时执行多次|
|29|  
|  
|业务正常运行中，破坏两份备节点voting file|  
|业务有问题，备节点offline|符合预期|date;ycsdump ycs set -o 4096 -c 1;ycsdump ycs set -o 4096 -c 0|
|30|  
|  
|网络故障并行，破坏主voting file|观察切主是否正常执行,恢复网络故障|备在线，切主,恢复网络故障后，原主加入集群|符合预期|  
|
|31|  
|  
|网络故障并行，破坏备voting file|  
|原主无影响，原备下线|符合预期|  
|
|32|  
|两副本数据破坏voting（cin)|运行时，破坏ycr数据一个1k，一个4k|  
|切主，主节点下线|符合预期|  
|
|33|  
|  
|运行时，破坏ycs数据一个2k，一个6k|  
|备节点切主，主节点下线|符合预期|  
|
|34|  
|  
|运行时，破坏ycs数据一个8k，一个10k|  
|两个节点都异常|符合预期|  
|
|35|  
|  
|网络故障并行，破坏ycs数据一个5k，一个7k|  
|  
|符合预期|date;dd if=/dev/urandom bs=1024 count=5 | yfscmd -D $YASCS_HOME cin -s 0 -c 1 +SYSTEM/voting;dd if=/dev/urandom bs=1024 count=7 | yfscmd -D $YASCS_HOME cin -s 0 -c 0 +SYSTEM/voting|
|36|  
|两副本数据破坏ycr(cin)|运行时，破坏ycr数据一个1k，一个4k|  
|  
|符合预期|YFS file block is corrupted|


3.2.5.3 五副本场景

|  
|场景|分场景|测试时机|观察点|测试预期|测试结果|备注|
|---|---|---|---|---|---|---|---|
|1|正常功能|部署集群功能|正常创建DB，配置YCR，拉起ycs|拉起流程|正常|符合预期|  
|
|2|  
|启停功能验证|正常拉起，下发业务，停止ycs|业务中可正常停止|正常|符合预期|  
|
|3|  
|  
|业务中停止ycs， 后拉起， 下发业务|重新拉起后可下发业务，无core|正常|符合预期|  
|
|4|  
|切主流程|kill主节点|切主行为是否正常|正常|符合预期|  
|
|5|破坏两份副本数据|dd整两个盘数据|创建system DG后，创建文件前|创建文件是否成功|  
|  
|  
|
|6|  
|  
|创建文件后，配置ycr前|配置ycr是否报错|  
|  
|  
|
|7|  
|  
|配置完ycr，拉起ycs前|ycs是否能够拉起|  
|  
|  
|
|8|  
|  
|运行时|ycr数据,topo|运行时，ycr数据可以 查询，但是一旦重启，拉不起来,topo没影响|  [待确认问题 0721 --待确认问题 YFS](https://conf.yasdb.com/pages/viewpage.action?pageId=159437682)  |dd if=/dev/urandom      of=/dev/yfs/ycsdisk1 bs=1M count=500,dd if=/dev/urandom      of=/dev/yfs/ycsdisk2 bs=1M count=500,DG broken|
|9|  
|两份副本数据破坏（ycsdump）|配置完ycr后，ycsdump破坏两份ycr数据|拉起ycs过程观察|成功|符合预期|  
|
|10|  
|  
|运行时，ycsdump破坏两份ycr数据|业务运行时观察,重新拉起|业务无问题,可重启|符合预期|ycsdump ycr set -o 0 -c 0;ycsdump ycr set -o 0 -c 1|
|11|  
|  
|业务正常运行中，ycsdump破坏主节点voting file|观察是否正常运行|业务无问题,topo没问题|符合预期|ycsdump ycs set -o 0 -c 1;ycsdump ycs set -o 0 -c 2,多次执行|
|12|  
|  
|业务正常运行中，ycsdump破坏备节点voting file|观察是否正常运行|业务无问题,topo没问题|符合预期|  
|
|13|  
|  
|切主过程中（主磁盘心跳故障），ycsdump破坏主节点voting file|观察切主是否正常执行|主节点业务停止，正常切主,原主被Yascsm拉起（故障自动清除）|符合预期|date;ycsctl set _fault_point 'YCS_RM_FAULT_POINT_27'    
  date; ycsctl set _fault_point 'CLEAN_ALL',ycsdump ycs set -o 0 -c 1;ycsdump ycs set -o 0 -c 2|
|14|  
|  
|备磁盘心跳故障，ycsdump破坏备节点voting file|  
|主被yascsm重拉,备没影响|符合预期|  
|
|15|  
|  
|网络故障并行，ycsdump破坏主备节点voting file|  
|  
|  
|  
|
|16|  
|两份副本数据破坏（cin）|配置完ycr后，cin破坏4k数据|  
|可以拉起|符合预期|  
|
|17|  
|  
|运行时，ycsmdump破坏1k ycr数据|  
|业务无影响,topo没变化,可重新拉起|符合预期|date;dd if=/dev/urandom bs=512 count=1 | yfscmd -D $YASCS_HOME cin -s 0 -c 1 +SYSTEM/ycr,date;dd if=/dev/urandom bs=512 count=1 | yfscmd -D $YASCS_HOME cin -s 0 -c 0 +SYSTEM/ycr|
|18|  
|  
|业务正常运行中，cin从offset=0破坏4k数据ycs|  
|业务无影响,topo没变化|符合预期|date;dd if=/dev/urandom bs=1024 count=4 | yfscmd -D $YASCS_HOME cin -s 0 -c 1 +SYSTEM/voting,date;dd if=/dev/urandom bs=1024 count=4 | yfscmd -D $YASCS_HOME cin -s 0 -c 0 +SYSTEM/voting|
|19|  
|  
|业务正常运行中，cin从offset=4096破坏2k数据ycs，一个破坏6k|  
|业务无影响,topo没变化|符合预期|date;dd if=/dev/urandom bs=1024 count=6 | yfscmd -D $YASCS_HOME cin -s 0 -c 1 +SYSTEM/voting,date;dd if=/dev/urandom bs=1024 count=8 | yfscmd -D $YASCS_HOME cin -s 0 -c 0 +SYSTEM/voting|
|20|  
|  
|业务正常运行中，cin从offset=0破坏6k数据,一个破坏8k|  
|业务无影响,topo没变化|符合预期|date;dd if=/dev/urandom bs=1024 count=8 | yfscmd -D $YASCS_HOME cin -s 0 -c 0 +SYSTEM/voting,date;dd if=/dev/urandom bs=1024 count=6 | yfscmd -D $YASCS_HOME cin -s 0 -c 1 +SYSTEM/voting|
|21|  
|  
|切主过程中（网络故障并行），cin从offset=0破坏10k数据|  
|  
|  
|  
|
|22|破坏三份副本数据|dd整三个盘数据|创建system DG后，创建文件前|创建文件是否成功|失败|  
|  
|
|23|  
|  
|创建文件后，配置ycr前|配置ycr是否报错|报错|  
|  
|
|24|  
|  
|配置完ycr，拉起ycs前|ycs是否能够拉起|拉不起来|  
|  
|
|25|  
|  
|运行时|ycr数据,topo|ycr数据全0,topo没变化|  
|dd if=/div/urandom      of=/dev/yfs/ycsdisk1 bs=1M count=500,dd if=/dev/urandom      of=/dev/yfs/ycsdisk2 bs=1M count=500,现在主节点没变化|
|26|  
|三副本数据破坏（ycrdump)|配置完ycr后，破坏ycr数据（ycsdump）|拉起ycs过程观察|失败|符合预期|  
|
|27|  
|  
|运行时，破坏ycr数据|业务运行时观察|查询ycr信息失败，重启失败|符合预期|YFS file block is corrupted|
|28|  
|  
|业务正常运行中，破坏三份主节点voting file|观察是否正常运行|业务有问题，主节点offline|符合预期|date;ycsdump ycs set -o 0 -c 1;ycsdump ycs set -o 0 -c 2;ycsdump ycs set -o 0 -c 3|
|29|  
|  
|业务正常运行中，破坏三份备节点voting file|  
|业务有问题，备节点offline|符合预期|  
|
|30|  
|  
|切主过程中（主磁盘心跳故障），破坏三份主voting file|观察切主是否正常执行,  
|备在线，切主,故障清除后，节点加入成功|符合预期|date;ycsdump ycs set -o 0 -c 1;ycsdump ycs set -o 0 -c 2;ycsdump ycs set -o 0 -c 3|
|31|  
|  
|切主过程中（主磁盘心跳故障），破坏三份备voting file|  
|切主,备有下线的过程|符合预期|date;ycsdump ycs set -o 4096 -c 1;ycsdump ycs set -o 4096 -c 2;ycsdump ycs set -o 4096 -c 3,topo短时间变化后，节点都上线了，此时磁盘心跳故障还没取消（yascsm拉起的）|
|32|  
|三副本数据破坏voting（cin)|运行时，破坏ycs数据一个1k，一个2k，一个3k|  
|切主，主节点下线|下线后会被拉起,  [待确认问题 （已对齐）-- 0721 问题1](https://conf.yasdb.com/pages/viewpage.action?pageId=159437641)  |date;dd if=/dev/urandom bs=1024 count=1 | yfscmd -D $YASCS_HOME cin -s 0 -c 1 +SYSTEM/voting;dd if=/dev/urandom bs=1024 count=2 | yfscmd -D $YASCS_HOME cin -s 0 -c 2 +SYSTEM/voting;dd if=/dev/urandom bs=1024 count=3 | yfscmd -D $YASCS_HOME cin -s 0 -c 3 +SYSTEM/voting|
|33|  
|  
|运行时，破坏ycs数据一个2k，一个6k，一个8k|  
|备节点切主，主节点下线|yascsm会拉起,  [待确认问题 （已对齐）-- 0721 问题1](https://conf.yasdb.com/pages/viewpage.action?pageId=159437641)  |date;dd if=/dev/urandom bs=1024 count=2 | yfscmd -D $YASCS_HOME cin -s 0 -c 1 +SYSTEM/voting;dd if=/dev/urandom bs=1024 count=6 | yfscmd -D $YASCS_HOME cin -s 0 -c 2 +SYSTEM/voting;dd if=/dev/urandom bs=1024 count=8 | yfscmd -D $YASCS_HOME cin -s 0 -c 3 +SYSTEM/voting|
|34|  
|  
|运行时，破坏ycs数据一个7k，一个8k，一个9k|  
|两个节点都异常|短时间异常，马上正常,  [待确认问题 （已对齐）-- 0721 问题1](https://conf.yasdb.com/pages/viewpage.action?pageId=159437641)  |date;dd if=/dev/urandom bs=1024 count=7 | yfscmd -D $YASCS_HOME cin -s 0 -c 1 +SYSTEM/voting;dd if=/dev/urandom bs=1024 count=8 | yfscmd -D $YASCS_HOME cin -s 0 -c 2 +SYSTEM/voting;dd if=/dev/urandom bs=1024 count=9 | yfscmd -D $YASCS_HOME cin -s 0 -c 3 +SYSTEM/voting|
|35|  
|  
|切主过程中（网络故障并行），破坏ycs数据一个5k，一个7k，一个8k|  
|  
|  
|  
|
|36|  
|三副本数据破坏ycr(cin)|运行时，破坏ycr数据一个1k，一个4k，一个6k|  
|YFS file block is corrupted|符合预期|date;dd if=/dev/urandom bs=1024 count=1 | yfscmd -D $YASCS_HOME cin -s 0 -c 1 +SYSTEM/ycr;dd if=/dev/urandom bs=1024 count=4 | yfscmd -D $YASCS_HOME cin -s 0 -c 2 +SYSTEM/ycr;dd if=/dev/urandom bs=1024 count=6 | yfscmd -D $YASCS_HOME cin -s 0 -c 3 +SYSTEM/ycr|
|37|  
|  
|运行时，破坏ycr数据一个1k，一个4k，一个6k后，kill -9 ycs|  
|ycs无法拉起|符合预期|  
|


### **【质量加固】**

**这里的"破坏"都是指破坏到无法使用，即(n/2+1)以上的副本**

|  
|主场景|场景描述|预期|测试结果|备注|
|---|---|---|---|---|---|
|1|存储网段故障叠加场景|破坏down主节点的存储网卡接着创建systemDG|无法创建成功|符合预期|YAS-05563 unsupported disk: /dev/yfs/ycsdisk1|
|2|  
|down掉主节点存储网卡接着破坏ycr file|  
|符合预期|一直卡着，等着超时失败，网卡恢复后ycs还可以起来（说明破坏失败）|
|3|  
|down掉主节点存储网卡接着破坏主节点voting file|  
|符合预期|一直卡着，等着超时失败，，网卡恢复后ycs还可以起来（说明破坏失败）|
|4|  
|down掉备节点存储网卡后破坏主节点voting file|  
|符合预期|  
|
|5|  
|丢包30%+破坏数据|  
|符合预期|同一节点丢包且数据破坏，丢包timeout时间内，topo会掉线；取消后，可恢复|
|6|  
|延迟10s（不超过超时时间）+破坏数据|  
|符合预期|同一节点延时且数据破坏，延时timeout时间内，topo会掉线；取消后，可恢复|
|7|四节点部署|kill ycs主同时破坏ycsdump中cluster block字段副本|数据会恢复|符合预期|  
|
|8|  
|破坏一主一备voting file|切主到id最小的节点|符合预期|  
|
|9|  
|破坏两备voting file|主不切，破坏的两备掉线|符合预期|  
,  
|
|10|  
|破坏一主两备voting file|最终为破坏数据的节点存活|符合预期|  
|
|11|  
|破坏三备voting file|原主存活|符合预期|  
|
|12|主备集群|ha_regress部署主备集群|单机，多机均可部署|符合预期|  
|
|13|  
|dd主集群的YCS盘（导致SYSTEM DG掉线）|备集群无影响|符合预期|  
|
|14|  
|dd备集群的YCS盘（导致SYSTEM DG掉线）|主集群无影响|符合预期|  
|
|15|  
|破坏主集群ycr副本（会导致YCS起不来）|备集群无影响|符合预期|  
|
|16|  
|破坏备集群ycr副本（会导致YCS起不来）|主集群无影响|符合预期|  
|
|17|  
|破坏主集群voting file副本（可观察到TOPO表现）|备集群无影响|符合预期|  
|
|18|  
|破坏备集群voting file副本（可观察到TOPO表现）|主集群无影响|符合预期|  
|


3.2.5.4 所有副本场景

注：目前只有关于副本读取失败的用例，至于副本写入失败，需要yfs给埋点。 读写接口失败，应该是无法精确到几个盘的，目前仅作所有盘失败的设计。（此部分可以根据开发提供埋点能力进行调整）

|场景|时机|预期|测试结果|备注|
|---|---|---|---|---|
|读副本数据失败（YFS埋点读失败）|~~配置ycr时~~|~~合理拦截~~|  
|  [多盘埋点](https://conf.yasdb.com/pages/viewpage.action?pageId=159416675)      
  没有分阶段，只有写盘失败，YCS提供|
|  
|~~配置完YCR，拉起YCS时~~|~~合理拦截~~|  
||
|  
|系统运行中|合理拦截|符合预期||
|写副本数据失败（YFS埋点读失败）|~~配置ycr时~~|~~合理拦截~~|  
|  [多盘埋点](https://conf.yasdb.com/pages/viewpage.action?pageId=159416675)      
  没有分阶段，只有写盘失败，YCS提供|
|  
|~~配置完YCR，拉起YCS时~~|~~合理拦截~~|  
||
|  
|系统运行中|合理拦截|符合预期||


### 3.2.6 强相关故障场景

本部分每个场景均要分单副本、三副本、五副本（n=1, 3, 5）三种冗余配置测试。

|场景|异常停止手段|观察点|预期|测试结果|备注|
|---|---|---|---|---|---|
|进程异常停止|kill -9由ycsm停止重拉|观察重拉后业务下发|无数据不一致（core）|符合预期|  
|
|  
|kill -19后过30秒由ycsm停止重拉|观察重拉后业务下发|无数据不一致（core）|符合预期|  
|
|  
|YFS埋点阶段性失败后，重拉|重拉是否正常|报错|  
|  
|
|通信网络故障|断网卡|预期与本需求前无差异|  
|符合预期|  
|
|存储网路故障|断磁阵网络|与副本全坏无差异|  
|  
|  
|
|  
|软链接n/2个盘失败|与副本破坏预期一致|  
|  
|软连接打开之后可能不影响，不确定|
|  
|软连接(n/2+1)盘失败|与副本破坏预期一致|  
|  
|  
|
|磁盘心跳故障|注入27号埋点|与本需求前无差异|  
|符合预期|27号埋点坏在写心跳前（等于一个副本都写不进去）|


### **3.2.7 ycsdump工具**

**ycsdump工具冗余功能发生变化，新方案仍可进行副本破坏（已有），保留ycr、voting file数据查看功能。**

|测试场景|处理方法|备注|
|---|---|---|
|针对所有冗余场景用例设计|破坏冗余区、非冗余区相关旧用例下架|  [dev_L3_cluster_fault_point_1_arm](https://jenkins.yasdb.com/user/xufanbo/my-views/view/xufanbo%27s%20view/job/dev_L3_cluster_fault_point_1_arm/)  |
|数据破坏及副本恢复功能|新增用例|通过上述副本功能的用例覆盖|
|重要数据查看功能，比如fence、age等字段|已有功能修改（用例调整）|  [dev_L2_cluster_ycs_arm](https://jenkins.yasdb.com/view/dev/view/dev_L2_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/dev_L2_cluster_ycs_arm/)  |


### **3.2.8 RTO**

RTO数据相对原有架构，应当不劣化。（这部分开发也会做，是否考虑合并测一次即可，取决于环境是否到位）

### 3.2.9 测试中需分析的复制工程（  这部分只能CI调整后跑  ）

  [https://jenkins.yasdb.com/view/%E9%97%AE%E9%A2%98%E5%A4%8D%E7%8E%B0/job/Agile_L2_cluster_yasft_ycs_arm_copy_xfb/](https://jenkins.yasdb.com/view/%E9%97%AE%E9%A2%98%E5%A4%8D%E7%8E%B0/job/Agile_L2_cluster_yasft_ycs_arm_copy_xfb/)  

  [https://jenkins.yasdb.com/view/%E9%97%AE%E9%A2%98%E5%A4%8D%E7%8E%B0/job/Agile_L3_cluster_fault_point_1_arm_copy_xfb/](https://jenkins.yasdb.com/view/%E9%97%AE%E9%A2%98%E5%A4%8D%E7%8E%B0/job/Agile_L3_cluster_fault_point_1_arm_copy_xfb/)  

  [https://jenkins.yasdb.com/view/%E9%97%AE%E9%A2%98%E5%A4%8D%E7%8E%B0/job/Agile_L3_cluster_ycs_4nodes_fault_1_copy_xfb1/](https://jenkins.yasdb.com/view/%E9%97%AE%E9%A2%98%E5%A4%8D%E7%8E%B0/job/Agile_L3_cluster_ycs_4nodes_fault_1_copy_xfb1/)  

  [https://jenkins.yasdb.com/view/%E9%97%AE%E9%A2%98%E5%A4%8D%E7%8E%B0/job/Agile_L3_cluster_fault_kill_arm_6_copy_xfb3/](https://jenkins.yasdb.com/view/%E9%97%AE%E9%A2%98%E5%A4%8D%E7%8E%B0/job/Agile_L3_cluster_fault_kill_arm_6_copy_xfb3/)  

### **3.2.10 是否涉及DFX测试**

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|否，本部分主要是系统稳定性变更，CT功能可延用已有工程进行检验|
|KT|是，考虑进程异常|
|长稳|不涉及压力专项，已有长稳测试可兼容|
|一致性|不涉及一致性专向，但在考虑故障前后业务一致性|
|三方测试工具    
  (sqltest，sqlancer)|不涉及，该需求不涉及sql语法层面的新增/修改|
|安全|不涉及，该需求不涉及用户密码/用户权限等安全性相关因素，所以不涉及安全专项|
|DFR|是，本身就是故障类测试，注意RTO测试|
|HA|规格中不支持HA模式|
|压力|此次测试不考虑压力专项，只维护基本功能|
|性能|此次测试不考虑性能专项，只维护基本功能|
|可维护性|是，用例会自动化维护|


# 4. 测试用例

冒烟：

[YCS支持多盘门槛用例.txt](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNzE4OTcwYzJhZjRmNTIxOGI1IiwicmVmX2lkIjoiNjczOTZlNzE3MjgyMDZlZmI5MmYyODE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMTQ1LCJleHAiOjE3ODI0NTg1NDV9.PMZq2aW7IsuOI0LeAvytn-UsXg0zKJA3UJrpmm3yjMA)

# 5. 测试框架设计

本测试影响所有测试框架的修改，主要涉及到部署，本需求测试过程中仅修改HA，其他框架修改在OM需求中完成。

# 6. 测试环境说明

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


# 7. 工作量评估

测试工作量：4人周

## Attachments:

[YCS支持多盘门槛用例.txt](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNzE4OTcwYzJhZjRmNTIxOGI1IiwicmVmX2lkIjoiNjczOTZlNzE3MjgyMDZlZmI5MmYyODE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMTQ1LCJleHAiOjE3ODI0NTg1NDV9.PMZq2aW7IsuOI0LeAvytn-UsXg0zKJA3UJrpmm3yjMA)

 (text/plain)    


[image2024-7-8_16-49-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNzFhMWFkOWEzMzExZGM5NzI4IiwicmVmX2lkIjoiNjczOTZlNzE3MjgyMDZlZmI5MmYyODE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMTQ1LCJleHAiOjE3ODI0NTg1NDV9.zD8ql6ydiYok0M_VKxw2ZOfa1fooT4P7cdOpToyCaEQ)

 (image/png)    


## Comments:

|  [](null)  ,【YDBRD-27439】YCS支持多盘--YCS测试设计评审会议纪要    
  一、会议时间：2024/06/24 星期一 10:00-11:00    
  二、会议地点：线上会议    
  三、会议主持人：徐凡博    
  四、参会人员：李垠、马勇、张茜、徐凡博    
  五、会议主题：【YDBRD-27439】YCS支持多盘--YCS测试设计评审（phase1）,已确定点：    
  1、create system DG时，使用未创建软连接的磁盘，在最新dev分支已经支持，rebase之后可用    
  2、运行中删除磁盘软连接是否影响业务或者命令使用，无法确定，如果句柄已经打开，无影响，如果句柄关闭重新打开会有影响,未解决：    
  1、对于ycs停止各阶段，只能给白盒手段hang住，无法给失败，确认后沟通-- 李垠    
  2、dd整个盘之后的行为，是否影响DG创建、touch ycr/ycs文件、拉起影响，待确认 -- 马勇    
  3、关于测试规格，目前DEV分支未合入master四节点测试的修复，是否考虑选择两节点转测。    
  4、目前YFS没办法精确给到读写某一个磁盘失败的方法，当前环境测试也无权限在运行时删除某一个lun，删掉软连接的方式也无法保证一定影响运行时表现，因此无法覆盖某一个或者多盘掉线、不可用的用户场景，这种是否能有其他手段可以切入。    
  5、副本问题待副本方案调整后修改再评。,Posted by xufanbo at 六月 24, 2024 11:31|
|---|
|  [](null)  ,6.25 9：20-9：35 二次讨论（phase2）,参会人员：孟凡彬、Trump、吕雷奇、李垠、马勇、张茜、徐凡博,1、目前考虑两节点转测,2、真实掉盘（删lun）场景仍需覆盖，同事开发给相应模拟埋点维护场景测试。,3、新方案副本不再修复，相关副本修复场景可删除。,Posted by xufanbo at 六月 25, 2024 09:45|
|  [](null)  ,开发 2024.6.24讨论结果：,一、非crc和副本错误，yfs返回失败，ycs自杀    
  二、yfs的读接口，返回值中携带”crc/副本错误“的节点号    
  三、保留多数派原则版本一致，返回成功，比如读到版本 2 1 1返回1，读到版本2 2 1，返回2    
  四、写接口改为：要求多数派写成功返回成功，否则返回失败    
  五、删除修复流程    
  六、离线故障副本的方案，规划到后续SR,Posted by xufanbo at 六月 25, 2024 11:47|
|  [](null)  ,2024.7.2对齐记录：,yfscmd create system diskgroup SYSTEM     – 非公开命令,yfscmd touch 新增文件类型 -t      – 非公开命令,Posted by xufanbo at 七月 02, 2024 16:42|
|  [](null)  ,错误码记录，待资料合入后核验：,YAS-05712 create cluster failed, reason: file/directory voting does not exist    
  YAS-05522 file/directory voting does not exist.,![](https://pingcode.yasdb.com/atlas/files/public/67396e71a1ad9a3311dc9729/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzIxNDUsImV4cCI6MTc4MjM4Mjk0NX0.5cmmg3g_vtB1UPj-WnLam9x-DjUT5nPQ0MY0f-TbrwU),Posted by xufanbo at 七月 04, 2024 11:37|
|  [](null)  ,YFS单机模式和集群模式可以在多个节点混合使用，需用文档约束,Posted by xufanbo at 七月 04, 2024 17:34|
|  [](null)  ,删除修复流程用例,Posted by xufanbo at 七月 08, 2024 18:24|
|  [](null)  ,对齐约束：,如果磁盘被DD掉，其所在的DG就不可以用了（dismount）,Posted by xufanbo at 七月 12, 2024 17:01|
|  [](null)  ,自动化局限：目前网络工程分别一个三副本，一个五副本，由于用例数目较少，不必新增单副本网络故障工程，在测综合场景是，单副本主要采用磁盘心跳故障来触发。,Posted by xufanbo at 七月 24, 2024 17:52|
