Created by 徐凡博, last modified on 八月 29, 2024

# 1. 概述

本文描述共享集群  YCS仲裁策略优化的测试设计。

SR:      [https://pingcode.yasdb.com/pjm/items/664c1f49288e1978208f8865](https://pingcode.yasdb.com/pjm/items/664c1f49288e1978208f8865)    ?    
  #YDBRD-27745 YCS故障仲裁策略优化

开发设计文档：    [【YCS】【YDBRD-27745】YCS仲裁策略优化](159439053.html)  

# 2. 需求分析

## 2.1 功能点分析

本需求通过优化集群仲裁算法，在集群发生网络隔离时  选出最优子集群，驱逐劣势子集群，并在最优子集群内选出新主。

针对现有逻辑发生变化的点：

1）最优子集群的产生，符合原则：  节点数量更多>有旧主>节点ID更小及  其他

2）在voting file中新增集群块（cluster block)， 记录选举结果和驱逐信息

3）DISK_HB_KEEP_ALIVE默认推荐值改为60，成倍大于NETWORK_HB_TIME（推荐值30）

## 2.2 应用场景

集群正常启停、并发启停、网络故障（断网卡、丢包、延迟等）、混合故障、voting file破坏性场景。

## 2.3 规格约束

**1）规格：**

- 部署形态：集群
- 节点数目：四节点（主），两节点（次）


**2）测试约束：**

|约束项|类型|内容|备注|
|---|---|---|---|
|网络连通一定是双向的|规格|单向的网络连通也被视为网络不可达|网络异常事件（如网络心跳超时）的感知可能有时差，在某一时刻可能出现单向的连通|
|子集群网络连接是完全图|规格|子集群内所有节点都彼此网络可达，形成完全图|YCS和YFS强调主备通信，备备断连是可接受的，但对集群数据库而言会影响业务；因此备备断连也会把集群划分为两个子集群；RAC亦如此|
|子集群的最优性|规格|节点数量更多>有旧主>节点ID更小及  **其他**|由于YCS和YFS在实例生命周期和选主上有不可避免的耦合性，因此具体实现时可能会考虑YFS实例状态作为子集群的最优性判断的一部分依据，待补充说明|
|kill block只是节点驱逐的软件方案|约束|kill block与scsi、ipmi等硬件能力属于同类接口，但无法保证极端场景下集群不双主、数据盘不双写|  
|
|极端场景kill block可能被覆写|规格|投票盘上的数据是动态数据，被覆写是可恢复的；且正常  节点读取kill block时会根据一些字段做校验，主节点也会定期写kill block并及时恢复kill block的合法性，因此不会造成致命异常|kill block并非某个节点专属，一旦旧主在写kill block之前被hang住直到超时，新主产生后旧主被恢复，则会导致kill block被覆写；可提供故障点进行测试验证|
|磁盘心跳超时时间与网络心跳超时时间的大小关系|规格|无大小关系的约束，但选举过程中要求节点在最短的超时时间内响应投票|当集群已在仲裁中，有更高的条件概率认为MIN(网络心跳超时， 磁盘心跳超时)时间内未响应选举的节点已异常|


# 3. 详细测试设计

## 3.1 测试设计方法

本需求主要采用场景法、正交组合法、错误推断法等测试方法进行设计。

## 3.2 详细测试设计

### **3.2.1 基础功能**

本部分主要排除对YCS基本功能的影响，通信网络故障3.2.2单列。

|  
|用例测试点|预置条件|测试步骤|预期结果|备注|测试时间点|进度|备注|
|:---|:---|:---|:---|:---|:---|---|---|---|
|1|正常启停|2节点|停主|观察切主行为|已有用例看护无需新增，手动测试即可|转测前|已测试|  
|
|2|正常启停|4节点|停一主|观察切主行为|已有用例看护无需新增，手动测试即可|转测前|已测试|  
|
|3|正常启停|4节点|停一备|不可切主|已有用例看护无需新增，手动测试即可|转测前|已测试|  
|
|4|并发启停|2节点|并发启动{1} {2}|并发启动时两个节点分别形成子集群，幸存者成为新主，另一节点也不被驱逐可直接加入新主|已有用例看护无需新增，手动测试即可,  [两节点并发启停工程--待复制](https://jenkins.yasdb.com/view/dev/view/dev_L3_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/dev_L3_cluster_para_startstop_arm_1/)  |转测前|已测试|  
|
|5|并发启停|4节点，{1}主|停止{1，2} 时并发启动{3} {4}|停止的节点不被驱逐而是正常停止，启动的节点之一被选为新主并升主|  [四节点并发工程--待复制](https://jenkins.yasdb.com/view/dev/view/dev_L3_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/dev_L3_cluster_ycs_4nodes_fault_1/)  ,打开四节点并发用例测试|转测前|手动测试难以确保并发，需要写自动化用例|  
|
|6|进程异常|4节点|kill主  -9， -19|kill -9导致网络断连/kill -19导致网络心跳超时，触发选举和仲裁，故障节点被驱逐，主变更|已有用例看护无需新增，手动测试即可|转测前|已测试|  
|
|7|进程异常|4节点|kill备 -9， -19|与主被kill -9/ kill -19的动作一致，但主不变|已有用例看护无需新增，手动测试即可|转测前|已测试|  [ycs_arb 问题记录](https://conf.yasdb.com/pages/viewpage.action?pageId=163000331)     问题1 |
|8|磁盘心跳故障|4节点|主故障|date;ycsctl set _fault_point 'YCS_RM_FAULT_POINT_27'    
  date; ycsctl set _fault_point 'CLEAN_ALL'|已有用例看护无需新增，手动测试即可|转测前|已测试|重拉起来|
|9|磁盘心跳故障|4节点|备故障|date;ycsctl set _fault_point 'YCS_RM_FAULT_POINT_27'    
  date; ycsctl set _fault_point 'CLEAN_ALL'|已有用例看护无需新增，手动测试即可|转测前|已测试|  
|
|10|磁阵网络故障|4节点|主故障|主自杀，其他节点走投票流程将备驱逐，主变更|已有用例看护无需新增，手动测试即可|转测前|已测试|  
|
|11|磁阵网络故障|4节点|备故障|备自杀，其他节点走投票流程将备驱逐，主不变|已有用例看护无需新增，手动测试即可|转测前|已测试|  
|


### 3.2.2 网络故障（需求重点）

主要指YCS之间通信网络故障。网络隔离手段需至少使用  断网卡 、丢包 、延迟等方式  来覆盖场景，其他网络故障优先级放低，手动测试全面覆盖，自动化可视预期稳定情况交叉覆盖。

可以复用的用例路径：yasft\ha\ha_cluster\testcase\fault_test\multi_ycs_fault\deploy_4nodes\network_fault\

|  
|用例测试点|预置条件|隔离子集|测试步骤|故障类型|预期结果（断网卡方式）|构造手段|测试时间点|进度|备注|复用旧用例/新用例（27745）|旧用例修改情况|
|---|---|:---|---|:---|---|:---|:---|---|---|---|---|---|
|1|网络故障|2节点|1，1|构造{1} 和 {2}网络隔离|断网卡,丢包,延迟|down网卡会导致网络心跳丢失直到超时,网络隔离时两个节点分别形成子集群，旧主幸存，另一节点被驱逐|  
|转测前|已测试|  
|test_sdv_ydbrd_21365_iofence_network_fault_003.py,这个路径不一样：yasft\ha\ha_cluster\testcase\fault_test\ycs_fault\iofence\|  
|
|2|网络故障|4节点, 1是主|1，3|{1} 和 {234}网络隔离|断网卡,丢包,延迟|成员数更多的{234}幸存|  
|转测前|已测试|  
|test_sdv_cluster_ydbrd_21560_network_isolated_1_3_001.py,test_sdv_cluster_ydbrd_21560_network_isolated_1_3_002.py,test_sdv_cluster_ydbrd_21560_network_isolated_1_3_003.py|  
|
|3|网络故障|4节点, 1是主|3，1|{134} 和{2}网络隔离|断网卡,丢包,延迟|成员数更多的{134}幸存且主不变|  
|转测前|已测试|  
|test_sdv_cluster_ydbrd_21560_network_isolated_3_1_001.py,test_sdv_cluster_ydbrd_21560_network_isolated_3_1_002.py,test_sdv_cluster_ydbrd_21560_network_isolated_3_1_003.py|  
|
|4|网络故障|4节点，1是主|1，1，2|{1} ， {2} ， {34} 网络隔离|断网卡,丢包,延迟|成员数更多的{34}幸存|  
|转测前|已测试，    [ycs_arb 问题记录](https://conf.yasdb.com/pages/viewpage.action?pageId=163000331)     问题2和问题4|  
|test_sdv_cluster_ydbrd_21560_network_isolated_2_2_004.py|  
|
|5|网络故障|4节点，1是主|2，1，1|{12} ，{3}，{4} 网络隔离|断网卡,丢包,延迟|成员数更多的{12}幸存|  
|转测前|已测试|  
|test_sdv_cluster_ydbrd_21560_network_isolated_2_2_003.py|  
|
|6|网络故障|4节点, 1是主|1，1，1，1|{1} 和 {2} 和 {3} 和 {4} 网络隔离|断网卡,丢包,延迟|成员数一致，旧主幸存 —— 理想预期，但实际上网络故障的感知有先后差异，此用例无固定预期|  
|转测前|已测试|  [ycs_arb 问题记录](https://conf.yasdb.com/pages/viewpage.action?pageId=163000331)     问题3|test_sdv_cluster_ydbrd_21560_network_isolated_3_1_004.py|done|
|7|网络故障|4节点, 1是主|2，2|{12} 和 {34}网络隔离|丢包,延迟|成员数一致，有旧主的子集群幸存|3、4节点丢掉来自1、2节点的包|转测前|已测试|{12}幸存,可恢复|test_sdv_cluster_ydbrd_21560_network_isolated_2_2_001.py,test_sdv_cluster_ydbrd_21560_network_isolated_2_2_002.py,  
|done|
|8|网络故障|4节点, 1是主|3， 3|{123} 和 {124} 网络隔离|断网卡,丢包,延迟|成员数一致，有旧主或ID小的子集群幸存|3，4间采用100%丢包构造即可|转测前|已测试，待自动化|{123}幸存,可恢复|test_sdv_cluster_ydbrd_27745_network_isolated_3_3_001.py|  
|
|9|网络故障|4节点, 1是主|3，3|{134} 和 {234} 网络隔离|断网卡,丢包,延迟|成员数一致，有旧主的子集群幸存|1，2采用100%丢包|转测前|已测试，待自动化|{134}幸存,可恢复|test_sdv_cluster_ydbrd_27745_network_isolated_3_3_002.py|  
|


### 【质量加固】：

|  
|  
|加固项|加固内容|预期|测试结果|备注|
|---|---|---|---|---|---|---|
|1|  
|开发自动化用例调试|test_sdv_cluster_ydbrd_27745_mix_fault_003.py,test_sdv_cluster_ydbrd_27745_mix_fault_008.py,test_sdv_cluster_ydbrd_27745_ycsdump_001.py,test_sdv_cluster_ydbrd_27745_ycsdump_002.py,及相关旧用例调试（上面表格1-5）|  
|  
|  
|
|2|  
|加固场景|构造1和4网络故障，2和3网络故障|会分成{12}{23}{34}{14}，最终{12}存活|  
|日志需要打到debug|
|3|  
|  
|构造1和2网络故障，3和4网络故障|会分成{13}{14}{23}{24}，最终{13}存活|  
|日志需要打到debug|
|4|  
|  
|构造1，2，3之间故障|会分成{14}{24}{34}，最终{14}存活|  
|日志需要打到debug|
|5|  
|  
|构造2，3，4之间故障|会分成{12}{13}{14}，最终{12}存活|  
|日志需要打到debug|


### 3.2.3 集群块访问（需求重点）

使用单副本模式进行破坏。

|  
|用例测试点|测试步骤|预期结果|测试时间点|进度|备注|
|:---|:---|:---|:---|---|---|---|
|1|正常运行中破坏集群块|部署4节点集群，使用ycsdump写全0或全1到集群块|主节点修复集群块，备节点不自杀|转测前|已测试|  
|
|2|进程异常中破坏集群块|部署四节点集群，kill -9 主ycs同时使用ycsdump集群块|集群先处理主节点异常，TELLER产生后修复集群块|转测前|已测试|  
|
|3|  
|ycsdump命令写坏集群块的同时{12}被kill -9|{34}幸存，新主产生后修复kill block并驱逐{12}|  
|已测试|  
|
|4|网络故障中破坏集群块|部署四节点集群，构造{1}，{234}网络隔离同时破坏ycsdump集群块|集群先处理网络隔离异常，TELLER产生后修复集群块|转测后|已测试，自动化待调试test_sdv_cluster_ydbrd_27745_ycsdump_003.py,  
|{234}幸存,1节点上：,cluster block is broken or invalid,ycs disk read, finish repair block|
|5|  
|部署四节点集群，构造{12}，{34}网络隔离同时破坏ycsdump集群块|集群先处理网络隔离异常，TELLER产生后修复集群块|转测后|已测试，自动化待调试test_sdv_cluster_ydbrd_27745_ycsdump_004.py|{12}幸存,1节点上：,repair disk error, crc check failed,ycs disk read, finish repair block,cluster block is broken or invalid|


### 3.2.4   DISK_HB_KEEP_ALIVE默认值变更

除需要修改已有测试用例之外，需要增加DISK_HB_KEEP_ALIVE参数与NETWORK_HB_TIMEOUT的约束测试。

同时，前面的用例都基于默认值进行测试。

|  
|测试点|DISK_HB_KEEP_ALIVE取值|NETWORK_HB_TIMEOUT取值|测试场景|测试预期|测试时间点|进度|备注|
|---|---|:---|:---|:---|---|---|---|---|
|1|默认值|60|30|3节点场景，{1} {23}发生网络故障（节点已经感知，即将发起选举），同时3发生磁阵网络故障35秒|节点1当选，2，3加入集群失败；通信网络恢复后，2，3加入集群|转测后|已测试，预期跟时间有关系|网卡恢复时间有差异，实际是23存活了,自动化1存活test_sdv_cluster_ydbrd_27745_param_test_001.py|
|2|两者相等|30|30|四节点，{1}磁盘心跳故障 ,{2}网卡down掉, {4}被kill -19|{2}为主|转测后|已测试|  
,test_sdv_cluster_ydbrd_27745_param_test_002.py|
|3|磁盘心跳<网络心跳|30|60|四节点，{1}存储网卡down掉 ,{3}网卡down掉|  
|  
|未测试|没时间测且场景不重要|
|4|较小值（RTO）|3|3|四节点，{1}存储网卡down掉 ,{3}网卡down掉，{4}被kill -9|  
|  
|未测试|没时间测且场景不重要|


### **3.2.5 流程埋点用例**

|埋点|预置条件|测试步骤|预期结果|备注|测试时间|进度|
|:---|:---|:---|:---|:---|:---|---|
|YCS_FAULT_POINT_22|提供故障点  YCS_FAULT_POINT_22  ， TELLER写集群块前hang住，模拟IO卡顿,  
|部署4节点集群，在任意节点注入  YCS_FAULT_POINT_22  后，注入FP_YCS_18触发投票，该节点会成为TELLER并在写集群块前hang住|选举超时，触发新的选举；被故障节点hang取消后，将上一轮选举和驱逐结果写到集群块,集群块被覆写时，若新主还未升主，则新主会报错并重新触发选举；若新主已升主，新主会用内存中的数据修复集群块|具体实现时，TELLER和主节点写集群块的底层接口一致，因此仅用一个故障点cover两个场景    
,YCS_FAULT_POINT_22  会让对应线程hang在IO请求外，以达到节点不自杀且覆写集群块的目的；,因此这俩故障点与实际IO卡顿的表现并不一致，不可用于其他场景，否则结果不可预期|转测前|已测试，待自动化|
|YCS_FAULT_POINT_22|提供故障点  YCS_FAULT_POINT_22  ， 主节点写集群块前hang住，模拟IO卡顿|部署4节点集群，在主节点上注入  YCS_FAULT_POINT_22  后，使用ycsdump写全0或全1到集群块，kill 任意其他节点触发选举|被故障节点hang取消后，将上一轮选举和驱逐结果写到集群块,集群块被覆写时，若新主还未升主，则新主会报错并重新触发选举；若新主已升主，新主会用内存中的数据修复集群块|  
|转测前|已测试，待自动化|


### 3.2.6 叠加故障场景

|  
|叠加故障类型|预置条件|测试步骤|预期结果|测试时间点|进度|备注|自动化|
|:---|:---|:---|:---|:---|---|---|---|---|
|1|网络故障+kill -19|4节点，1是主|{1} 和 {234}网络隔离的同时{34}被kill -19 一半的超时时间|TELLER等待{3，4}参与选举，成员数更多的{234}幸存|转测前|已自动化且调通|  [ycs_arb 问题记录](https://conf.yasdb.com/pages/viewpage.action?pageId=163000331)     问题8, 10，11 |test_sdv_cluster_ydbrd_27745_mix_fault_001.py|
|2|  
|4节点，1是主|{1} 和 {234}网络隔离的同时{34}被kill -19 直到超时|TELLER等待{3，4}参与选举到超时，未参与选举的{34}不被视为{234}的有效成员，{1}和{2}竞争，旧主{1}幸存|转测后|已测试|1、第一次测了kill -9: {1}幸存{2}{3}{4}加入集群失败；取消故障后恢复,2、kill -19 {1}幸存|test_sdv_cluster_ydbrd_27745_mix_fault_002.py|
|3|网络故障+kill -9|4节点，1是主|{1} 和 {234}网络隔离的同时{34}被kill -9|TELLER等待{3，4}参与选举，中途2感知到34异常将其设为不可见，因此不需要等待到超时，仲裁结果同上|转测前|已自动化|断网卡需要等待到超时才触发选举，但kill -9会立即触发断连和选举，导致很难卡时间和自动化|test_sdv_cluster_ydbrd_27745_mix_fault_003.py|
|4|  
|4节点，1是主|{124}和{3}隔离时， {12}被kill -9|  
|转测后|已测试|{3}幸存，恢复网络后，可加入  – 后期会优化    [ycs_arb 问题记录](https://conf.yasdb.com/pages/viewpage.action?pageId=163000331)     问题5|test_sdv_cluster_ydbrd_27745_mix_fault_004.py|
|5|网络故障+启停|4节点，1是主|{1} 和 {23}网络隔离的同时启动{4}|成员数更多的{23}幸存，新主产生后{4}加入新主|转测前|已自动化且调通|  
|test_sdv_cluster_ydbrd_27745_mix_fault_005.py|
|6|  
|4节点，1是主|{12} 和 {3}网络隔离的同时启动{4}|成员数更多的{12}幸存且主保持不变，仲裁结束后{4}加入{1}|转测后|已测试|{12}幸存，{4}起来后加入，取消网络故障后{3}加入|test_sdv_cluster_ydbrd_27745_mix_fault_006.py|
|7|  
|4节点，1是主|{4}启动的同时{1}被kill -9|{23}幸存，新主产生后{4}加入新主 （瞬间现象 符合）|转测后|已测试|切主为2节点，1，4加入{23}集群|test_sdv_cluster_ydbrd_27745_mix_fault_007.py|
|8|  
|4节点，1是主|{1} 被kill -19 的同时，{2} 和 {3}网络隔离，启动{4}   （需考虑kill -18的时间点，超时不超时）|{2}幸存，仲裁结束后{4}加入{2}|转测前|已自动化，00801调通|  
|test_sdv_cluster_ydbrd_27745_mix_fault_008.py,test_sdv_cluster_ydbrd_27745_mix_fault_008_1.py|
|9|网络故障+磁盘心跳埋点|4节点，1是主|{123}{4}隔离 ，{12}注入磁盘心跳埋点|date;ycsctl set _fault_point 'YCS_RM_FAULT_POINT_27',{3}幸存，12磁盘心跳超时后自杀重新加入3|转测前|已自动化且调通|  
|  
|
|10|  
|  
|{1}{234}隔离 ，{1}{2}注入磁盘心跳埋点|date;ycsctl set _fault_point 'YCS_RM_FAULT_POINT_27',{3}为主，{234}存活，{1}{2}业务会中止|转测后|已测试|{3}为主，{234}存活，{1}{2}业务会中止,恢复网络后恢复|test_sdv_cluster_ydbrd_27745_mix_fault_010.py|
|11|网络故障+磁阵网络故障|4节点，1是主|{12}{34}隔离，{1}{3}磁阵网络故障（超时/不超时）|TELLER等待{1} {3}参与选举直到超时，{2} {4}竞争|转测前|已自动化且调通|  [ycs_arb 问题记录](https://conf.yasdb.com/pages/viewpage.action?pageId=163000331)     问题12|test_sdv_cluster_ydbrd_27745_mix_fault_011.py,test_sdv_cluster_ydbrd_27745_mix_fault_011_1.py|
|12|  
|  
|{124}{3}隔离，{12}磁阵网络故障（超时/不超时）|TELLER等待{1} {2}参与选举直到超时，{3} {4}竞争|转测后|已测试，待自动化|超时恢复：{3}幸存，124加入失败，恢复后124加入3--同样小集群幸存,不超时：也是{3}幸存    [ycs_arb 问题记录](https://conf.yasdb.com/pages/viewpage.action?pageId=163000331)     问题6 --20多秒  几秒恢复的话就是{124}存活|test_sdv_cluster_ydbrd_27745_mix_fault_012.py,test_sdv_cluster_ydbrd_27745_mix_fault_012_1.py|
|13|混沌测试|  
|  
|已有CI看护用例进行测试|转测前|  
|  
|  
|


### **3.2.7 RTO看护**

|用例测试点|分类|预置条件|测试步骤|预期结果|备注|测试时间点|进度|
|:---|---|:---|:---|:---|:---|---|---|
|RTO看护|RTO|4节点|kill/reboot备机|- kill：被kill的备节点会被yascsm重新拉起，等待中的TELLER感知到节点重启就无需继续等待
- reboot：被reboot的备节点不会被yascsm重新拉起，等待中的TELLER感知到已参与选举的节点数大于等于集群节点数的一半就无需继续等待（若reboot的备机过多，会引入一个超时时间）
,RTO在秒级且与超时时间配置无关|RTO重点看护2节点，需求测试4节点（  可能环境不到位  ）,  
,实际结果,- kill RTO = vote interval * 4 + 1
- reboot RTO = vote interval * 4 + DISK_HB_KEEP_ALIVE(等待孤儿DB超时)
|建议转测后开发做（环境所限）|已测试|
|RTO看护|RTO|4节点|kill/reboot主机|- kill：被kill的主会被yascsm重新拉起，等待中的TELLER感知到节点重启就无需继续等待
- reboot：被reboot的主节点不会被yascsm重新拉起，等待中的TELLER感知到已参与选举的节点数大于等于集群节点数的一半就无需继续等待（若两节点reboot主机，备节点会认为1:1时仍然需要等待旧主，会引入一个超时时间）
,RTO在秒级且与超时时间配置无关|- kill RTO = vote interval * 4 + 1
- rebooy RTO = vote interval * 4 + DISK_HB_KEEP_ALIVE(升主时等待旧主超时)
|建议转测后开发做（环境所限）|已测试|
|RTO看护|RTO|4节点|down备机私网网卡|感知到网络断连的节点会发起投票，网卡故障的备机被驱逐，且投票前后主节点不变,RTO在秒级且与超时时间配置无关|- kill RTO = vote interval * 4 + 1
|建议转测后开发做（环境所限）|  
|
|RTO看护|RTO|4节点|down主机私网网卡|感知到网络断连的节点会发起投票，网卡故障的主机被驱逐，投票后产生新的主节点,RTO在秒级且与超时时间配置无关|- kill RTO = vote interval * 4 + 1
|建议转测后开发做（环境所限）|  
|


  


### 3.2.8 测试中需分析的复制工程

  [https://jenkins.yasdb.com/user/xufanbo/my-views/view/xufanbo's%20view/job/master_L2_cluster_yasft_ycs_arm/](https://jenkins.yasdb.com/user/xufanbo/my-views/view/xufanbo)  

  [https://jenkins.yasdb.com/view/master/view/master_L3_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/master_L3_cluster_para_startstop_arm_1/](https://jenkins.yasdb.com/view/master/view/master_L3_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/master_L3_cluster_para_startstop_arm_1/)  

  [https://jenkins.yasdb.com/view/master/view/master_L3_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/master_L3_cluster_ycs_4nodes_fault_1/](https://jenkins.yasdb.com/view/master/view/master_L3_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/master_L3_cluster_ycs_4nodes_fault_1/)  

  [https://jenkins.yasdb.com/user/xufanbo/my-views/view/xufanbo's%20view/job/master_L3_cluster_fault_kill_arm_4/](https://jenkins.yasdb.com/user/xufanbo/my-views/view/xufanbo)  

  [https://jenkins.yasdb.com/user/xufanbo/my-views/view/xufanbo's%20view/job/master_L3_cluster_fault_point_1_arm/](https://jenkins.yasdb.com/user/xufanbo/my-views/view/xufanbo)  

  [https://jenkins.yasdb.com/user/xufanbo/my-views/view/xufanbo's%20view/job/master_L3_cluster_fault_kill_arm_6/](https://jenkins.yasdb.com/user/xufanbo/my-views/view/xufanbo)  

  [https://jenkins.yasdb.com/view/master/view/master_%E5%BE%85%E4%B8%8A%E6%9E%B6/job/master_L3_cluster_ycs_4nodes_network_fault_1_copy_xfb/](https://jenkins.yasdb.com/view/master/view/master_%E5%BE%85%E4%B8%8A%E6%9E%B6/job/master_L3_cluster_ycs_4nodes_network_fault_1_copy_xfb/)  

## 3.3 是否涉及DFX测试

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

# 5. 测试框架设计

# 6. 测试环境说明

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


# 7. 工作量评估

测试工作量：

  


## Attachments:

[image2024-8-15_16-59-57.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNzRhMWFkOWEzMzExZGM5NzMyIiwicmVmX2lkIjoiNjczOTZlNzQ3MjgyMDZlZmI5MmYyODJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMjQ5LCJleHAiOjE3ODI0NTg2NDl9.RjdxVF3k7LwPPzKofZwsQEqhXRaoqawOCy-d-R0GT3M)

 (image/png)    


[image2024-8-15_17-1-10.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNzRhMWFkOWEzMzExZGM5NzMzIiwicmVmX2lkIjoiNjczOTZlNzQ3MjgyMDZlZmI5MmYyODJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMjQ5LCJleHAiOjE3ODI0NTg2NDl9.sQClxrIwhVwM6LLklnGyq2x71ME72hQ05YxYQTt_e4A)

 (image/png)    


[image2024-8-15_17-2-24.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNzRhMWFkOWEzMzExZGM5NzM0IiwicmVmX2lkIjoiNjczOTZlNzQ3MjgyMDZlZmI5MmYyODJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMjQ5LCJleHAiOjE3ODI0NTg2NDl9.9AvvxH-PraDE_g3moNC6ae3IlEWWdn0bJP6EXq0FJKM)

 (image/png)    


[image2024-8-15_17-2-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNzQ4OTcwYzJhZjRmNTIxOGMwIiwicmVmX2lkIjoiNjczOTZlNzQ3MjgyMDZlZmI5MmYyODJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMjQ5LCJleHAiOjE3ODI0NTg2NDl9.AKr2xmko3NWCJKgB699RGnCt28A60PcUHBqlajtY72Y)

 (image/png)    


[image2024-8-15_17-4-20.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNzQ4OTcwYzJhZjRmNTIxOGMxIiwicmVmX2lkIjoiNjczOTZlNzQ3MjgyMDZlZmI5MmYyODJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMjQ5LCJleHAiOjE3ODI0NTg2NDl9.k5h-_-woaZobZbsLrXMnHji6x-Mk9MnfATvh05lnRs4)

 (image/png)    


[image2024-8-15_17-5-56.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNzRhMWFkOWEzMzExZGM5NzM1IiwicmVmX2lkIjoiNjczOTZlNzQ3MjgyMDZlZmI5MmYyODJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMjQ5LCJleHAiOjE3ODI0NTg2NDl9.okWPYF0u8PNpfRCNdIkGqPZlgoAwVeSk6XfOI8BRoeI)

 (image/png)    


[image2024-8-15_17-6-1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNzRhMWFkOWEzMzExZGM5NzM2IiwicmVmX2lkIjoiNjczOTZlNzQ3MjgyMDZlZmI5MmYyODJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMjQ5LCJleHAiOjE3ODI0NTg2NDl9.9wE_C4zeXV4XTdpyaxEs0zzBbjh_3jq-ARE405WkUqU)

 (image/png)    


[image2024-8-19_17-43-26.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNzRhMWFkOWEzMzExZGM5NzM3IiwicmVmX2lkIjoiNjczOTZlNzQ3MjgyMDZlZmI5MmYyODJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMjQ5LCJleHAiOjE3ODI0NTg2NDl9.m9Mkpjr7_rKOZrO3I7yCb5fNtXPrzfuhkkv8wtxFN_o)

 (image/png)    


[image2024-8-20_11-36-40.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNzQ4OTcwYzJhZjRmNTIxOGMyIiwicmVmX2lkIjoiNjczOTZlNzQ3MjgyMDZlZmI5MmYyODJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMjQ5LCJleHAiOjE3ODI0NTg2NDl9.dtHDrAwxGOOLqb-CL3P4h3L8NnjlZBlh0CKiaPYGbhw)

 (image/png)    


[image2024-8-20_11-36-53.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNzU4OTcwYzJhZjRmNTIxOGMzIiwicmVmX2lkIjoiNjczOTZlNzQ3MjgyMDZlZmI5MmYyODJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMjQ5LCJleHAiOjE3ODI0NTg2NDl9.RfLgpgVE6kCJeDu6Glogy91FYJmYSDJbkYQxkELEHds)

 (image/png)    


[image2024-8-21_17-39-11.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNzVhMWFkOWEzMzExZGM5NzM4IiwicmVmX2lkIjoiNjczOTZlNzQ3MjgyMDZlZmI5MmYyODJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMjQ5LCJleHAiOjE3ODI0NTg2NDl9.w89ceHpuBxlcTMftxiJXA1RwkvdjwVI6Wndqojy9Ygg)

 (image/png)    


## Comments:

|  [](null)  ,【YDBRD-27745】YCS仲裁策略优化测试设计评审会议纪要    
  一、会议时间：2024/08/09 周五15：30-16:00    
  二、会议地点：线上会议    
  三、会议主持人：徐凡博    
  四、参会人员：李垠、陈俊杰、杜宇轩、徐凡博    
  五、会议主题：【YDBRD-27745】YCS仲裁策略优化测试设计评审,会议纪要：    
  1、目前主测四节点，由于是dev分支，YCS模块将cherry-pick四节点故障问题单过来，但是YFS问题单暂不合过来，遇到问题重新定位,2、标黄部分为转测后测试，具体根据问题单情况再划分。,  
  测试设计文档：    
  ---       [【YDBRD-27745】YCS仲裁策略优化 -- 测试设计](162994201.html)  ,Posted by xufanbo at 八月 09, 2024 18:07|
|---|
|  [](null)  ,转测前问题记录：    [ycs_arb 问题记录](https://conf.yasdb.com/pages/viewpage.action?pageId=163000331)  ,Posted by xufanbo at 八月 15, 2024 15:07|
|  [](null)  ,当前框架默认值DISK_HB_KEEP_ALIVE不改，只需要yasboot适配，规避风险即可,![](https://pingcode.yasdb.com/atlas/files/public/67396e75a1ad9a3311dc9739/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzIyNDksImV4cCI6MTc4MjM4MzA0OX0.d3R7Ok1X2QqGjAGqsI1yd5xr11bFP8636oLE8ltRQVU),Posted by xufanbo at 八月 15, 2024 15:27|
