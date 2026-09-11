Created by 张丽红, last modified by  牛亚娜 on 十一月 12, 2024

**IR链接：**    [https://pingcode.yasdb.com/ship/ideas/66cc7b844283cf23d4f3c39a](https://pingcode.yasdb.com/ship/ideas/66cc7b844283cf23d4f3c39a)    **?**    
  **#YASHAN-3183 集群支持Undo亲和**

**SR链接：**    [https://pingcode.yasdb.com/pjm/items/670c7e2ce489dd0868f6bf66](https://pingcode.yasdb.com/pjm/items/670c7e2ce489dd0868f6bf66)    **?**    
  **#YDBRD-34014 集群支持Undo对象亲和**

**开发设计文档链接：**    [YASHAN-3183 集群支持undo亲和概要设计](https://conf.yasdb.com/pages/viewpage.action?pageId=171057208)  

# 1. 概述

### 需求出现背景：

在应用分区的场景下，如果一个实例频繁访问的对象，其资源元数据信息一部分在其它实例上管理，此时会有一些不必要的全局资源请求开销，基于此考虑，需要支持对象级的资源管理，  即支持指定对象对应的资源主节点。即OHT的概念。

该需求引入OHT的概念，在OHT的基础上，提供undo亲和能力，使当前实例可以直接访问本实例的undo数据，从而减少访问远端资源所带来的开销，进而提升性能。

# 2. 需求分析

## 2.1 功能点分析

1. 开启undo亲和性时，对当前undo表空间下的事务管理、事务访问、undo分配、一致性回滚、XA等功能无影响
1. 开启undo亲和性时，可以适配实例启停、实例故障、在线恢复、全量恢复


## 2.2 应用场景

- 需求本身的主要应用场景


1. 支持开启/关闭undo亲和能力：针对隐藏参数"_undo_affinity"的测试
1. 针对OHT机制的验证：主要针对对象资源访问、对象资源迁移、对象资源恢复
1. undo亲和前提下，对已有相关功能的影响和冲击，主要涉及undo表空间下的事务管理、事务访问、undo分配、一致性回滚、xa功能等
1. 支持查看undo亲和策略及策略详情：针对视图"  X$GRC_OBJECT、V$GRC_AFFINITY_POLICY，GV$GRC_AFFINITY_POLICY  "以及对涉及到结构变更的原有视图（  V$GRC_RESOURCE、GV$GRC_RESOURCE、V$RESOURCE_REQUEST、GV$RESOURCE_REQUEST、V$RESOURCE_REQUEST、GV$RESOURCE_REQUEST  ）的测试


  


- 需求与其他特性的关联场景


1. 和实例启停/实例并发启停的交互：实例启停时涉及OHT资源的迁移
1. OHT资源迁移和资源并发访问的交互：资源迁移过程中访问资源，原则上和reform过程中访问资源的表现是一致的，资源迁移只是remaster当中的一个子流程
1. 和故障之间的交互：纯实例故障，以及带业务场景下实例故障和OHT资源迁移过程中实例故障，及故障后的恢复，这些都是需要考虑的场景
1. 和性能的交互：对原有性能的交互以及混合负载分区的影响/在应用分区场景下的性能提升/指定master到本实例后，单实例跑批业务的性能表现
1. 和RTO的交互：原则上对rto的冲击比较小，但是需要验证一下
1. 和集群主备的交互：需要考虑主备场景下的OHT信息同步以及实例启停和故障恢复的适配    （主备的undo亲和性可以设置不一致）


## 2.3 规格约束

### 2.3.1 约束/范围

1、该需求涉及的部署形态为：集群

2、集群支持的节点个数：2/3/4 都要考虑

3、undo亲和管理仅针对于实例undo表空间下管理的对象，而不是整个表空间层面

4、临时表空间UNDO属于全局分配资源，不受UNDO亲和管理

5、_undo_affinity参数需要各实例间配置一致

### 2.3.2 配置参数规格

新增配置参数：_UNDO_AFFINITY（参数相关测试用例参考"全局资源分布策略优化"即可）

|参数名称|参数类型|参数取值类型|生效方式|默认值|是否只读|
|---|---|---|---|---|---|
|_UNDO_AFFINITY|隐藏参数|TRUE | FALSE|重启生效|TRUE|否|


  


2.3.3 视图规格

新增动态视图：  X$GRC_OBJECT       不开启undo亲和时，视图字段显示为空

|字段|类型|描述|
|:---|:---|:---|
|ID|INTEGER|buffer object 在内存中的ID|
|OBJ|BIGINT|亲和策略对应的data object id|
|POLICY|SMALLINT|亲和策略：0为默认策略，即按GHT分布；1，指定实例亲和；2，自动亲和，目前为预留类型|
|MASTER|SMALLINT|亲和实例|
|CURRENT_MASTER|SMALLINT|obj当前所在的实例（当亲和实例不在线时，会被托管至其他在线实例）|
|PREVIOUS_MASTER|SMALLINT|上一次的亲和实例|
|STATUS|SMALLINT|当前资源迁移状态|


新增动态视图：  V$GRC_AFFINITY_POLICY

|字段|类型|描述|
|:---|:---|:---|
|DATA_OBJECT_ID|BIGINT|亲和策略对应的data object id|
|POLICY|VARCHAR(8)|亲和策略：DEFAULT为默认策略，即按GHT分布；AFFINITY，指定实例亲和；AUTO，自动亲和，目前为预留类型|
|MASTER|SMALLINT|亲和实例|
|CURRENT_MASTER|SMALLINT|obj当前所在的实例（当亲和实例不在线时，会被托管至其他在线实例）|
|PREVIOUS_MASTER|SMALLINT|上一次的亲和实例|
|STATUS|SMALLINT|当前资源迁移状态|


新增动态视图：GV$GRC_AFFINITY_POLICY

|字段|类型|描述|
|:---|:---|:---|
|DATA_OBJECT_ID|BIGINT|亲和策略对应的data object id|
|POLICY|VARCHAR(8)|亲和策略：亲和策略：DEFAULT为默认策略，即按GHT分布；AFFINITY，指定实例亲和；AUTO，自动亲和，目前为预留类型|
|MASTER|SMALLINT|亲和实例|
|CURRENT_MASTER|SMALLINT|obj当前所在的实例（当亲和实例不在线时，会被托管至其他在线实例）|
|PREVIOUS_MASTER|SMALLINT|上一次的亲和实例|
|STATUS|SMALLINT|当前资源迁移状态|
|GROUP_ID|NUMBER|组ID|
|GROUP_NODE_ID|NUMBER|组内节点ID|
|INST_ID|NUMBER|实例ID|


新增fixed table：  X$GRC_OBJ_RES：查询V$GRC_RESOURCE时，可以获取到来自X$GRC_OBJ_RES的信息（type固定为0）

|字段|类型|描述|
|:---|:---|:---|
|RESOURCE_NAME|VARCHAR(128)|资源名称，block资源[space][file][id]|
|XOWNER|TINYINT|持有写锁或最近一次持有写锁的节点|
|OWNER_COUNT|TINYINT|持有资源的节点数|
|OWNER_MAP|BIGINT|持有资源的节点位图，64位整型值，每一位代表节点的ID，如果该节点持有资源，ownerMap中对应的位设置为1|
|PASTCOPY_MAP|BIGINT|持有PASTCOPY的节点位图，此字段标记持有该BLOCK的PASTCOPY资源的节点|
|IN_PROCESS|BOOLEAN|是否有节点请求获取当前资源|
|REQUEST_COUNT|TINYINT|资源上当前请求消息数量|
|DISK_LSN|BIGINT|最近一次刷盘的LSN|
|WRITE_INST|TINYINT|正在刷盘的实例ID|
|OBJ|BIGINT|当前资源所属的对象ID|


新增fixed table：  X$GRC_OBJ_REQ：查询V$RESOURCE_REQUEST时，可以获取到来自X$GRC_OBJ_REQ的信息

|字段|类型|描述|
|:---|:---|:---|
|RESOURCE_NAME|VARCHAR(128)|资源名称，block资源[space][file][id]|
|TYPE|INTEGER|请求类型|
|INSTANCE_ID|INTEGER|发出请求消息的节点ID|
|SESSION_ID|INTEGER|发出请求消息的会话ID|
|SERIAL_NO|INTEGER|请求消息的序列号|
|IN_PROCESS|BOOLEAN|当前请求是否正在处理|


新增fixed table：X$GRC_OBJ_PC：查询V$GRC_PASTCOPY时，可以获取到来自X$GRC_OBJ_PC的信息

|字段|类型|描述|
|:---|:---|:---|
|TS#|INTEGER|页面space id|
|FILE#|INTEGER|页面file id|
|BLK#|INTEGER|页面ID|
|RESOURCE_NAME|VARCHAR(128)|资源名称，block资源[space][file][id]|
|INSTANCE_ID|TINYINT|持有该PAST COPY BLOCK的节点|
|LSN|BIGINT|PAST COPY BLOCK的LSN（Log Sequence Number）|


对原有动态视图结构的更改：

1、集群支持  UNDO亲和后，undo表空间下的对象block会通过OHT管理，所以相关视图需要能查到这些block对应的gcs资源，涉及视图：GRC相关视图（V$GRC_RESOURCE、GV$GRC_RESOURCE、V$RESOURCE_REQUEST、GV$RESOURCE_REQUEST、V$RESOURCE_REQUEST、GV$RESOURCE_REQUEST）

2、对原有相关视图的字段类型做了修改："TYPE"字段的数据类型由"TINYINT"变更为"INTEGER"，涉及视图：GRC相关视图（V$GRC_RESOURCE、GV$GRC_RESOURCE）

# 3. 详细测试设计

## 3.1 测试设计方法

测试设计主要围绕 2.2 中描述的应用场景展开，对于每一项测试点，描述使用的测试方法，具体详细测试点在3.3中描述

- 需求本身的主要应用场景


1. 支持开启/关闭undo亲和能力：采用配置参数公共项测试方法，主要使用等价类和边界值法
1. 针对OHT机制的验证：这部分不做单独验证，在关联场景中一起验证
1. undo亲和前提下-对已有相关功能的影响和冲击：复用单机和集群已有用例
1. 支持查看undo亲和策略及策略详情：采用动态视图公共项测试方法，主要使用场景法


  


- 需求与其他特性的关联场景


1. 和实例启停/实例并发启停的交互：业务层面的表现复用已有用例，细节层面的表现主要采用场景法
1. OHT资源迁移和资源并发访问的交互：这部分需要新增用例，主要采用场景法
1. 和故障之间的交互：业务层面的表现复用已有用例，细节层面的表现主要采用场景法/正交组合法
1. 和性能的交互：主要采用场景法，需要新增业务模型
1. 和RTO的交互：采用场景法
1. 和集群主备的交互：采用场景法/错误推测法/正交组合法


## 3.2 关联特性/依赖分析

1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|系统级DFX分类|是否涉及|
|---|---|
|CT|资源迁移和资源并发访问之间的并发以及空间复用和并发访问之间的并发，涉及，在功能中考虑，不再单独考虑|
|KT|上述并发过程种的故障以及该特性和reform之间的交互，涉及，在功能种考虑，不再单独考虑|
|长稳|需要跑长稳功能模型和长稳tpcc模型，关闭/开启undo亲和的前提下，借用长稳工程跑，需要测试|
|一致性|涉及并发和故障，所以必然涉及一致性，复用已有工程进行看护即可|
|三方测试工具    
  (sqltest，sqlancer)|不涉及新增sql语法，不涉及|
|安全|不涉及密码/权限/安全等相关操作，不涉及|
|DFR|纯内核特性，和DFR的类型关联性不大，已有DFR工程有故障类型的看护|
|HA|集群HA部署以及HA部署模式下的故障已支持，需要考虑集群ha模式下的基本功能和集群ha模式下的故障，功能层面新增用例，故障测试层面选取部分已有集群ha故障工程进行复用|
|压力|一定业务压力下的测试需要覆盖，但是会测tpcc性能，可以走到这部分逻辑，所以这里不做单独测试|
|性能|1、对原有性能不影响,2、涉及到该特性特有的tpcc跨节点读undo的场景，需要单独构造业务模型|
|可维护性|该需要涉及到新增系统表/视图/配置参数等，所以涉及可维护性，涉及资料|
|RTO|该特性会影响到rto，需要覆盖2节点和4节点场景下的rto测试，选一种故障类型即可，覆盖db的master角色和非master角色故障|


## 3.3 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*


### 3.3.1 支持开启/关闭undo亲和能力，针对这一功能点的测试

**说明：**  这部分属于已有配置参数，参数设置以及语法校验层面，复用已有用例即可；业务层面需要新增测试场景，业务层面新增测试场景时主要使用基本场景法

已有用例参考如下：

  [https://ytp.yasdb.com/#/common/case?newQuery={%22activity%22:%22FT%22,%22activeFeature%22:39667,%22versions%22:[61],%22caseName%22:%22test_sdv_ydbrd_29967_016%22](https://ytp.yasdb.com/#/common/case?newQuery={%22activity%22:%22FT%22,%22activeFeature%22:39667,%22versions%22:[61],%22caseName%22:%22test_sdv_ydbrd_29967_016%22)    }，16，17，

  [https://git.yasdb.com/cod-test/yasft/-/blob/master/ha/ha_cluster/testcase/common/global_memory/grc/object_manager/ght/node2/test_sdv_ydbrd_29967_017_002.py](https://git.yasdb.com/cod-test/yasft/-/blob/master/ha/ha_cluster/testcase/common/global_memory/grc/object_manager/ght/node2/test_sdv_ydbrd_29967_017_002.py)       002，003

新增测试场景如下：这里业务可以参考"3.3.5"中的业务构造方式

|场景编号|场景描述|备注|
|---|---|---|
|1|参数取默认值时，相关视图中"  POLICY  "字段值为"  AFFINITY  "|  
|
|2|参数取值为"False"时，相关视图中"  POLICY  "字段值为空|  
|
|3|开启undo亲和开关前后，从资源管理的角度验证是否真正做到了实例亲和|测试方法：,1）参数值取"False"时，查询当前实例的undo相关页面的master;,2）参数值取"True"时，查询当前实例的undo相关页面的master；,3）步骤1中，查询到的master包含了所有实例；步骤2中，查询到的master只有当前实例|
|4|undo使用的过程中，修改该参数的值，从"True"修改为"False"，并重启集群，重启集群后继续下业务|这里涉及资源管理策略变化，从OHT变为GHT|
|5|undo使用的过程中，修改该参数的值，从"False"修改为"True"，并重启集群，重启集群后继续下业务|这里涉及资源管理策略变化，从GHT变为OHT|
|6|undo使用的过程中，修改该参数的值，从"True"到"False"，再到"True"，经历多次变更，在每次变更时，都重启集群并下业务|验证OHT<---->GHT之间多次转换对原有GHT机制的冲击|


### 3.3.2 undo亲和前提下，对已有相关功能的影响和冲击，针对这一功能点的测试

**说明：**  这部分属于机制变更后，对原有用例的影响，可复用已有用例，主要涉及"事务管理、事务访问、undo分配、一致性回滚、XA"等功能

已有用例参考如下：

  [https://git.yasdb.com/cod-test/yasft/-/tree/master/cluster/testcase/storage/transaction](https://git.yasdb.com/cod-test/yasft/-/tree/master/cluster/testcase/storage/transaction)  

  [https://git.yasdb.com/cod-x/yastest_dfx/-/merge_requests/3944/diffs#fd1234e2e20aa675015c548c41ffa4c65e528812](https://git.yasdb.com/cod-x/yastest_dfx/-/merge_requests/3944/diffs#fd1234e2e20aa675015c548c41ffa4c65e528812)  

  [https://git.yasdb.com/cod-test/yasft/-/merge_requests/10030](https://git.yasdb.com/cod-test/yasft/-/merge_requests/10030)  

  [https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/storage/transaction_01](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/storage/transaction_01)  

  [https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/storage/transaction_02](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/storage/transaction_02)  

  [https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/storage/transaction_03](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/storage/transaction_03)  

### 3.3.3 支持查看undo亲和策略及策略详情，针对这一功能点的测试

**说明：**  这部分用例属于动态视图专项测试，采用动态视图公共测试方法即可，主要使用场景法和等价类法。fixed table不做单独验证，只验证公共测试点，其它v$/gv$视图需要单独构造业务场景。对于已有视图，但是变更了视图结构的视图相关的测试点，单独阐述。

公共测试场景如下：

|场景编号|场景描述|有效等价类|无效等价类|备注|
|---|---|---|---|---|
|  
|视图命名的规范性验证|命名规范|命名不规范|  
|
|  
|对应视图在资料中有新增，新增信息是否正确|新增信息正确|新增信息不正确|  
|
|  
|视图所包含字段的测试|字段正确|字段错误|查询时可验证字段的大小写情况|
|  
|**视图字段值的准确性测试**|**字段值准确**|**字段值不准确**|**构造相应的场景看字段值是否准确且合理，这部分需要根据视图单独梳理和构造业务场景**|
|  
|  
|**动态值可以被捕获**|**动态值无法捕获**|**构造相应的场景看动态值的变化能否被捕捉，这部分需要根据视图单独梳理和构造业务场景**|
|  
|视图查询（是否带filter）的测试|查询不带filter，查询结果匹配准确|查询不带filter，查询结果匹配不准确|  
|
|  
|  
|查询带filter，filter条件正确|查询带filter，filter条件不正确|  
|
|  
|  
|添加filer后的查询结果匹配准确|添加filer后的查询结果匹配不准确|  
|
|  
|视图写操作拦截测试|drop,insert,delete,update等写操作被拦截，无法成功操作|drop,insert,delete,update等写操作未被拦截，成功操作|  
|
|  
|**视图并发查询测试**|**带业务并发查询视图，表现正常**|**带业务并发查询视图，表现异常**|**这部分需要单独梳理**|


需要单独构造和梳理的业务场景如下：

|视图名称|场景|子场景|备注|
|---|---|---|---|
|X$GRC_OBJECT|针对"DATA_OBJECT_ID"字段值的校验|和DBA_OBJECTS视图中的对象id字段值做对比，两者值保持一致|  
|
|  
|针对"POLICY"字段值的校验|关闭undo亲和开关时，检查该字段的值，值为0|  
|
|  
|  
|默认配置/开启undo亲和开关时，检查该字段的值，值为1|  
|
|  
|针对"MASTER"字段值的校验|关闭undo亲和开关时，检查该字段的值，值为空|  
|
|  
|  
|默认配置/开启undo亲和开关时，检查该字段的值，每个实例的undo对象对应的亲和实例为自己本身|  
|
|  
|针对"CURRENT_MASTER"字段值的校验|集群默认配置下部署时，检查该字段的值，每个实例的undo对象对应的亲和实例为自己本身|  
|
|  
|  
|2节点集群，实例1停止时，检查实例1的undo对象该字段的值，该字段的值为实例2|  
|
|  
|  
|2节点集群，实例2故障时，检查实例2的undo对象该字段的值，该字段的值为实例1|  
|
|  
|  
|4节点集群，实例1故障时，检查实例1的undo对象该字段的值，该字段的值为实例2|  
|
|  
|  
|3节点集群，实例2停止时，检查实例2的undo对象该字段的值，该字段的值为实例1|  
|
|  
|  
|4节点集群，实例1和实例2同时故障时，检查实例1和实例2的undo对象该字段的值，该字段的值为实例3和实例4|  
|
|  
|  
|2节点集群，实例1故障之后，检查实例1的undo对象该字段的值：该字段的值为实例2,实例1故障恢复之后，再次检查实例1的undo对象该字段的值：该字段的值恢复为实例1|  
|
|  
|  
|4节点集群，实例2停止之后，检查实例2的undo对象该字段的值：该字段的值为实例1,实例2再次启动之后，再次检查实例2的undo对象该字段的值：该字段的值恢复为实例2|  
|
|  
|  
|4节点集群，实例1和实例2同时故障时，检查实例1和实例2的undo对象该字段的值：该字段的值为实例3和实例4,实例1和实例2故障恢复后，再次检查实例1和实例2的undo对象该字段的值：该字段的值分别恢复为实例1和实例2|  
|
|  
|  
|4实例集群下，带业务的前提下，某个实例故障后，整个集群处于reform阶段的过程中（构造rerform时间比较长，OHT资源迁移用时比较久的场景   如何构造？  ），动态查询该字段的值：该字段的值为实例xx reform的过程中该字段值不会发生变化，不会有core/hungd等情况产生,待reform恢复完成后，再次查询该字段的值：该字段的值和reform过程中的值一致，不会有变化|暂无构造方法，只能尝试构造|
|  
|针对"PREVIOUS_MASTER"字段值的校验|该字段值和"CURRENT_MASTER"字段一起验证即可，不再单独验证，场景和上一个字段的场景一致|这次转测该字段值固定为-1|
|  
|针对"STATUS"字段值的校验|~~默认配置下，检查该字段的值，该字段的值显示"未进行资源迁移"~~|  
|
|  
|  
|~~2节点集群下，故障节点1，检查该字段的值，该字段的值显示"正在进行资源迁移"~~|  
|
|  
|  
|~~2节点集群下，停止节点2，检查该字段的值，该字段的值显示"正在进行资源迁移"~~|  
|
|  
|  
|~~2节点集群下，故障节点1，检查该字段的值，该字段的值显示"正在进行资源迁移"~~,~~节点1故障恢复之后，再次检查该字段的值，该字段的值显示"未进行资源迁移"~~|  
|
|  
|  
|~~2节点集群下，停止节点2，检查该字段的值，该字段的值显示"正在进行资源迁移"~~,~~节点1重新启动之后，再次检查该字段的值，该字段的值显示"未进行资源迁移"~~|  
|
|  
|  
|~~4节点集群下，带业务的前提下，同时故障节点1和节点2，整个集群处于reform阶段的过程中，动态检查该字段的值，不会有core/hungd等情况产生~~,~~待reform恢复完成后，查询该字段的值：该字段的值显示"未进行资源迁移"~~|  
|
|  
|  
|~~4节点集群下，带业务的前提下，同时故障节点2和节点3，整个集群处于reform阶段的过程中，动态检查该字段的值，不会有core/hungd等情况产生~~,~~待reform恢复完成后，查询该字段的值：该字段的值显示"未进行资源迁移"~~|  
|
|  
|  
|~~2节点集群下，节点1故障后立刻拉起，检查整个过程中该字段的值。该字段的值显示"正在进行资源迁移"~~|  
|
|  
|业务和查询视图操作并发|undo相关业务操作进行的过程中，动态查询该视图的值，无core/hung现象|  
|
|  
|  
|undo相关业务操作进行的过程中，动态查询该视图的值，带有故障，无core/hung现象|  
|
|  
|  
|undo相关业务操作进行的过程中，动态查询该视图和其它关联视图的值（v$buffer_control/v$sys.obj$/v$grc_resource），带有故障，无core/hung现象|  
|
|V$GRC_AFFINITY_POLICY|验证点同上一个视图|  
|  
|
|GV$GRC_AFFINITY_POLICY|验证点同一个视图，但需要单独增加针对实例id相关的验证|  
|  
|
|  
|针对"  GROUP_ID  "/”GROUP_NODE_ID“/”  INST_ID  “字段值的校验|默认配置下，检查该视图的值，各个实例对应各自实例的obj信息，无错位情况|  
|
|  
|  
|不开启undo亲和时，检查该视图的值，各个实例对应各自实例的obj信息，无错位情况|  
|


对于已有视图，但是变更了视图结构的视图，测试时，主要从以下两个维度进行：

1、对于字段类型发生变更的视图：关注转测包中字段是否和开发详细设计文档中描述一致即可

2、对于新增的OHT相关的信息，不必单独进行专项测试，在复用已有用例的前提下，新增对于单个OHT对象信息正确性的校验场景即可，在"3.3.4"的测试中可以覆盖到

已有相关用例可以参考如下：

```
SELECT * FROM  GUIDER.TESTKILLTABLE WHERE 
VERSION ='master' AND FEATURE_PATH ='/heap/yac/ct/10' 
AND "GROUP" ='25';
SELECT * FROM  GUIDER.TESTKILLTABLE WHERE 
VERSION ='master' AND FEATURE_PATH ='/heap/yac/ct/10' 
AND "GROUP" ='7';

SELECT * FROM  GUIDER.TESTKILLTABLE WHERE 
VERSION ='master' AND FEATURE_PATH ='/heap/yac/kt/10' 
AND "GROUP" ='25';
SELECT * FROM  GUIDER.TESTKILLTABLE WHERE 
VERSION ='master' AND FEATURE_PATH ='/heap/yac/kt/10' 
AND "GROUP" ='7';
SELECT * FROM  GUIDER.TESTKILLTABLE WHERE 
VERSION ='master' AND FEATURE_PATH ='/heap/yac/kt/5' 
AND "GROUP" ='28';
```

  


### 3.3.4 和实例启停/实例并发启停的交互，针对这一功能点的测试

**说明：**  这部分其实是针对OHT的资源迁移机制进行验证，从业务层面的操作入口就是实例启停以及并发启停，业务层面重点关注业务的正确性，复用已有用例，细节层面的测试使用单独新增的场景验证。

已有用例如下：

  [https://jenkins.yasdb.com/user/hezhiwei/my-views/view/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_DBOpen_arm_1_copy_zlh/)      [zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_DBOpen_arm_1_copy_zlh/)      [Agile_L3_cluster_DBOpen_arm_1_copy_zlh/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_DBOpen_arm_1_copy_zlh/)  

  [https://jenkins.yasdb.com/user/hezhiwei/my-views/view/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_DBOpen_arm_2_copy_zlh/)      [zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_DBOpen_arm_2_copy_zlh/)      [Agile_L3_cluster_DBOpen_arm_2_copy_zlh/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_DBOpen_arm_2_copy_zlh/)  

  [https://jenkins.yasdb.com/user/hezhiwei/my-views/view/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_DBOpen_arm_3_copy_zlh/)      [zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_DBOpen_arm_3_copy_zlh/)      [Agile_L3_cluster_DBOpen_arm_3_copy_zlh/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_DBOpen_arm_3_copy_zlh/)  

  [https://jenkins.yasdb.com/user/hezhiwei/my-views/view/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/%E5%88%AB%E4%BA%BA%E7%9A%84copy/job/Agile_L3_cluster_DBOpen_arm_4_copy_zlh/)      [%E5%88%AB%E4%BA%BA%E7%9A%84copy/job/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/%E5%88%AB%E4%BA%BA%E7%9A%84copy/job/Agile_L3_cluster_DBOpen_arm_4_copy_zlh/)      [Agile_L3_cluster_DBOpen_arm_4_copy_zlh/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/%E5%88%AB%E4%BA%BA%E7%9A%84copy/job/Agile_L3_cluster_DBOpen_arm_4_copy_zlh/)  

  [https://jenkins.yasdb.com/user/hezhiwei/my-views/view/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/%E5%88%AB%E4%BA%BA%E7%9A%84copy/job/Agile_L3_cluster_DBOpen_arm_5_copy_zlh/)      [%E5%88%AB%E4%BA%BA%E7%9A%84copy/job/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/%E5%88%AB%E4%BA%BA%E7%9A%84copy/job/Agile_L3_cluster_DBOpen_arm_5_copy_zlh/)      [Agile_L3_cluster_DBOpen_arm_5_copy_zlh/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/%E5%88%AB%E4%BA%BA%E7%9A%84copy/job/Agile_L3_cluster_DBOpen_arm_5_copy_zlh/)  

  [https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_para_startstop_arm_1_copy_zlh/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_para_startstop_arm_1_copy_zlh/)  

新增单点测试场景如下：

考虑的单点测试因子如下：

|测试因子|有效等价类|备注|
|---|---|---|
|节点个数|2节点|  
|
|  
|3节点|  
|
|  
|4节点|  
|
|导致资源迁移的操作|节点启动|  
|
|  
|节点停止|  
|
|  
|节点故障|  
|
|资源迁移经历的次数|迁移1次|  
|
|  
|迁移多次|  
|
|迁移的资源的个数|1个资源|  
|
|  
|多个资源|  
|
|被迁移资源对应实例的角色|master角色|  
|
|  
|非master角色|  
|
|资源是否迁移回原实例|迁移回原实例|  
|
|  
|不迁移回原实例|  
|
|资源迁移的过程中是否带业务|不带业务|  
|
|  
|带业务|  
|
|资源迁移的过程中是否有2次故障|带2次故障|  
|
|  
|不带2次故障|  
|


将上述测试因子正交组合后得到如下测试场景：测试场景中除了需要验证新增视图层面的表现，还需要验证是否真正做到了undo亲和，以及资源是否真正迁移成功，从资源管理的角度来验证，验证方式如下：

（1）关闭undo亲和时，根据undo objID查询实例1下的undo相关block所属的master    
  （2）开启undo亲和时，根据undo objID查询实例1下的undo相关block所属的master    
  （3）场景1中，master为实例1+实例2；场景2中，master全部为实例1

|场景编号|节点个数|导致资源迁移的操作|资源迁移经历的次数|迁移的资源的个数|被迁移资源对应实例的角色|资源是否迁移回原实例|资源迁移的过程中是否带业务|资源迁移的过程中是否有2次故障|备注|
|---|---|---|---|---|---|---|---|---|---|
|1|2节点|节点启动|迁移1次|多个资源|非master角色|迁移回原实例|不带业务|带2次故障|  
|
|2|4节点|节点启动|迁移多次|1个资源|master角色|不迁移回原实例|带业务|不带2次故障|  
|
|3|3节点|节点停止|迁移1次|1个资源|master角色|迁移回原实例|不带业务|不带2次故障|  
|
|4|2节点|节点故障|迁移多次|多个资源|非master角色|不迁移回原实例|带业务|不带2次故障|  
|
|5|4节点|节点故障|迁移多次|1个资源|master角色|迁移回原实例|不带业务|带2次故障|  
|
|6|3节点|节点故障|迁移1次|1个资源|非master角色|不迁移回原实例|带业务|带2次故障|  
|
|7|2节点|节点停止|迁移多次|多个资源|master角色|不迁移回原实例|带业务|带2次故障|  
|
|8|3节点|节点停止|迁移多次|多个资源|非master角色|不迁移回原实例|不带业务|带2次故障|  
|
|9|3节点|节点启动|迁移多次|多个资源|master角色|迁移回原实例|带业务|不带2次故障|  
|
|10|4节点|节点停止|迁移1次|多个资源|非master角色|不迁移回原实例|带业务|不带2次故障|  
|
|11|2节点|节点故障|迁移多次|1个资源|非master角色|迁移回原实例|带业务|不带2次故障|  
|


### 3.3.5 OHT资源迁移和资源并发访问的交互，针对这一功能点的测试

**说明：**  针对OHT资源迁移和资源并发访问的交互，业务层面在"3.3.4"的启停场景中可全部覆盖，这里不做单独验证，但是这里需要新增细节层面的测试场景。在"3.3.4"中可全量覆盖，这里重点关注业务的构造方式

新增场景时考虑的单点测试因子如下：

|测试因子|有效等价类|无效等价类|备注|
|---|---|---|---|
|下发业务的实例|实例1/2/3/4|  
|在3+节点下，资源迁移到哪个节点上是随机的，所以这里下业务时，可以在所有实例上下业务|
|触发资源迁移的操作|实例启动|  
|  
|
|  
|实例停止|  
|  
|
|资源迁移过程中涉及到的业务操作|undo segment|  
|建表后，并发插、删、改表，夹杂回滚、提交，同时查询，可以kill执行业务的用例|
|  
|undo block|  
|CR页面构造：建表插入数据，并发查询,索引：反复插入、批插、insert into select、删除、更新数据，并回滚，或者提交前kill执行业务的实例,表：与索引一样类似的操作|
|  
|事务|  
|上面的测试应该可以涵盖|
|  
|XA事务|  
|并发执行一些有关XA的用例|
||其它可能有问题的点||1、回滚时，读取undo数据，这里是指主动回滚：同场景2，包括两种场景，全部回滚，回滚到savepoint,2、故障时，数据库自动回滚："有长事务运行的过程中kill session",3、闪回时，读取undo数据，"delete操作后闪回读取delete之前的数据"，分2种场景，让数据被单个实例修改过/让数据被多个实例修改过|


### 3.3.6   和故障之间的交互，针对这一功能点的测试

**说明：**  这部分其实是针对OHT的资源恢复机制进行验证，从业务层面的操作入口就是实例故障，实例故障场景在”3.3.4“的启停场景中已全部覆盖，除此之外，还需要复用故障相关的已有用例。

已有用例如下：

  [https://jenkins.yasdb.com/user/hezhiwei/my-views/view/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_fault_kill_arm_1_copy_zlh/)      [zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_fault_kill_arm_1_copy_zlh/)      [Agile_L3_cluster_fault_kill_arm_1_copy_zlh/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_fault_kill_arm_1_copy_zlh/)  

  [https://jenkins.yasdb.com/user/hezhiwei/my-views/view/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_fault_kill_arm_2_copy_zlh/)      [zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_fault_kill_arm_2_copy_zlh/)      [Agile_L3_cluster_fault_kill_arm_2_copy_zlh/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_fault_kill_arm_2_copy_zlh/)  

  [https://jenkins.yasdb.com/user/hezhiwei/my-views/view/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_fault_kill_arm_3_copy_zlh/)      [zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_fault_kill_arm_3_copy_zlh/)      [Agile_L3_cluster_fault_kill_arm_3_copy_zlh/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_fault_kill_arm_3_copy_zlh/)  

  [https://jenkins.yasdb.com/user/hezhiwei/my-views/view/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_fault_kill_arm_5_copy_zlh2/)      [zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_fault_kill_arm_5_copy_zlh2/)      [Agile_L3_cluster_fault_kill_arm_5_copy_zlh2/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_fault_kill_arm_5_copy_zlh2/)  

  [https://jenkins.yasdb.com/user/hezhiwei/my-views/view/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_fault_kill_arm_7_copy_zlh/)      [zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_fault_kill_arm_7_copy_zlh/)      [Agile_L3_cluster_fault_kill_arm_7_copy_zlh/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_fault_kill_arm_7_copy_zlh/)  

  [https://jenkins.yasdb.com/user/hezhiwei/my-views/view/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_fault_kill_arm_8_copy_zlh/)      [zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_fault_kill_arm_8_copy_zlh/)      [Agile_L3_cluster_fault_kill_arm_8_copy_zlh/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_fault_kill_arm_8_copy_zlh/)  

  [https://jenkins.yasdb.com/user/hezhiwei/my-views/view/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_fault_kill_arm_9_copy_zlh3/)      [zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_fault_kill_arm_9_copy_zlh3/)      [Agile_L3_cluster_fault_kill_arm_9_copy_zlh3/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_fault_kill_arm_9_copy_zlh3/)  

  [https://jenkins.yasdb.com/user/hezhiwei/my-views/view/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_multi_fault_kill_arm_1_copy_zlh/)      [zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_multi_fault_kill_arm_1_copy_zlh/)      [Agile_L3_cluster_multi_fault_kill_arm_1_copy_zlh/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_multi_fault_kill_arm_1_copy_zlh/)  

  [https://jenkins.yasdb.com/user/hezhiwei/my-views/view/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_multi_fault_kill_arm_2_copy_zlh/)      [zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_multi_fault_kill_arm_2_copy_zlh/)      [Agile_L3_cluster_multi_fault_kill_arm_2_copy_zlh/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_multi_fault_kill_arm_2_copy_zlh/)  

  [https://jenkins.yasdb.com/user/hezhiwei/my-views/view/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_multi_fault_kill_arm_3_copy_zlh/)      [zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_multi_fault_kill_arm_3_copy_zlh/)      [Agile_L3_cluster_multi_fault_kill_arm_3_copy_zlh/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_multi_fault_kill_arm_3_copy_zlh/)  

  [https://jenkins.yasdb.com/user/hezhiwei/my-views/view/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_multi_fault_kill_arm_4_copy_zlh/)      [zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_multi_fault_kill_arm_4_copy_zlh/)      [Agile_L3_cluster_multi_fault_kill_arm_4_copy_zlh/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_multi_fault_kill_arm_4_copy_zlh/)  

  [https://jenkins.yasdb.com/user/hezhiwei/my-views/view/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_multi_fault_kill_arm_5_copy_zlh/)      [zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_multi_fault_kill_arm_5_copy_zlh/)      [Agile_L3_cluster_multi_fault_kill_arm_5_copy_zlh/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_multi_fault_kill_arm_5_copy_zlh/)  

  [https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_multi_fault_kill_arm_6_copy_zlh/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_multi_fault_kill_arm_6_copy_zlh/)  

  [https://jenkins.yasdb.com/user/hezhiwei/my-views/view/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L2_cluster_CT_gcs_arm_copy_zlh/)      [zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L2_cluster_CT_gcs_arm_copy_zlh/)      [Agile_L2_cluster_CT_gcs_arm_copy_zlh/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L2_cluster_CT_gcs_arm_copy_zlh/)  

  [https://jenkins.yasdb.com/user/hezhiwei/my-views/view/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_heap_CT_btree_arm_copy_zlh/)      [zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_heap_CT_btree_arm_copy_zlh/)      [Agile_L3_cluster_heap_CT_btree_arm_copy_zlh/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_heap_CT_btree_arm_copy_zlh/)  

  [https://jenkins.yasdb.com/user/hezhiwei/my-views/view/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_heap_CT_gcs_arm_copy_zlh/)      [zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_heap_CT_gcs_arm_copy_zlh/)      [Agile_L3_cluster_heap_CT_gcs_arm_copy_zlh/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_heap_CT_gcs_arm_copy_zlh/)  

  [https://jenkins.yasdb.com/user/hezhiwei/my-views/view/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_heap_CT_gcs_basic_arm_copy_zlh/)      [zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_heap_CT_gcs_basic_arm_copy_zlh/)      [Agile_L3_cluster_heap_CT_gcs_basic_arm_copy_zlh/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_heap_CT_gcs_basic_arm_copy_zlh/)  

  [https://jenkins.yasdb.com/user/hezhiwei/my-views/view/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_heap_CT_gcs_bcr_arm_copy_zlh/)      [zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_heap_CT_gcs_bcr_arm_copy_zlh/)      [Agile_L3_cluster_heap_CT_gcs_bcr_arm_copy_zlh/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_heap_CT_gcs_bcr_arm_copy_zlh/)  

  [https://jenkins.yasdb.com/user/hezhiwei/my-views/view/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_heap_CT_gcs_pc_arm_copy_zlh/)      [zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_heap_CT_gcs_pc_arm_copy_zlh/)      [Agile_L3_cluster_heap_CT_gcs_pc_arm_copy_zlh/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_heap_CT_gcs_pc_arm_copy_zlh/)  

  [https://jenkins.yasdb.com/user/hezhiwei/my-views/view/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L2_cluster_KT_gcs_arm_copy_zlh/)      [zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L2_cluster_KT_gcs_arm_copy_zlh/)      [Agile_L2_cluster_KT_gcs_arm_copy_zlh/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L2_cluster_KT_gcs_arm_copy_zlh/)  

  [https://jenkins.yasdb.com/user/hezhiwei/my-views/view/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_heap_KT_gcs_arm_copy_zlh/)      [zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_heap_KT_gcs_arm_copy_zlh/)      [Agile_L3_cluster_heap_KT_gcs_arm_copy_zlh/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_heap_KT_gcs_arm_copy_zlh/)  

  [https://jenkins.yasdb.com/user/hezhiwei/myviews/view/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_heap_KT_gcs_basic_arm_copy_zlh/)      [zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_heap_KT_gcs_basic_arm_copy_zlh/)      [Agile_L3_cluster_heap_KT_gcs_basic_arm_copy_zlh/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_heap_KT_gcs_basic_arm_copy_zlh/)  

  [https://jenkins.yasdb.com/user/hezhiwei/my-views/view/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_heap_KT_gcs_bcr_arm_copy_zlh/)      [zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_heap_KT_gcs_bcr_arm_copy_zlh/)      [/Agile_L3_cluster_heap_KT_gcs_bcr_arm_copy_zlh/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_heap_KT_gcs_bcr_arm_copy_zlh/)  

  [https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_heap_KT_gcs_pc_arm_copy_zlh/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_heap_KT_gcs_pc_arm_copy_zlh/)  

### 3.3.7 和性能的交互  ，针对这一功能点的测试

**说明：**  这部分主要是不影响已有性能，且对"大并发、长事务同时带有一定节点亲和性"的业务场景的性能提升，需要验证的场景如下：

|场景编号|场景描述|预期|备注|
|---|---|---|---|
|1|X86环境下的2节点tpcc分区表性能验证|和主干无差异，不劣化|  
|
|2|X86环境下的4节点tpcc分区表性能验证|和主干无差异，不劣化|  
|
|3|涉及到该特性特有的tpcc跨节点读undo的场景，需要单独构造业务模型|主干包和转测包相比，性能有较大提升|业务模型待讨论|


### 3.3.8 和RTO的交互  ，针对这一功能点的测试

**说明：**  这部分该特性会对rto有一定影响，需要验证影响程度有多大，验证典型场景，需要验证的详细场景如下：

|场景编号|场景描述|预期|备注|
|---|---|---|---|
|1|2节点场景下，db的master角色发生kill类型故障|rto值不超过20s|  
|
|2|2节点场景下，db的非master角色发生kill类型故障|rto值不超过20s|  
|
|3|4节点场景下，db的master角色发生kill类型故障|rto值不超过20s|  
|
|4|4节点场景下，db的非master角色发生kill类型故障|rto值不超过20s|  
|


### 3.3.9 和集群主备的交互  ，针对这一功能点的测试

**说明：**  这部分主要针对集群HA场景下的基本典型场景进行校验

|场景编号|场景|子场景|预期|备注|
|---|---|---|---|---|
|1|主备场景下，undo亲和能力可正常开启|主备部署模式下，备机开启undo亲和开关，下发基础业务|业务可正常进行，不受影响|  
|
|2|主备场景下，备机undo亲和能力可正常使用|备机多个实例"_undo_affinity"参数设置为不同值|报错，集群启动失败|  
|
|3|  
|备机2节点部署，带业务的前提下，节点1停止后，OHT对象可迁移到节点2|业务正常进行，OHT对象正常迁移|  
|
|4|  
|备机2节点部署，带业务的前提下，节点2停止后，OHT对象可迁移到节点1|业务正常进行，OHT对象正常迁移|  
|
|5|  
|备机4节点部署，带业务的前提下，节点1故障后，OHT对象可迁移到其它存活节点|业务正常进行，OHT对象正常迁移|  
|
|6|  
|备机3节点部署，带业务的前提下，节点2故障后，OHT对象可迁移到其它存活节点|业务正常进行，OHT对象正常迁移|  
|
|7|  
|备机4节点部署，带业务的前提下，节点1和节点2同时故障后，OHT对象可迁移到其它存活节点,节点1和节点4再次启动后，OHT对象可迁移回原实例|业务正常进行，OHT对象正常迁移,节点再次启动后，OHT对象可正常迁移回原实例|  
|
|8|主备场景下，主备可正常切换|主备都开启undo亲和时，带业务的前提下，做switchover|主备可切换成功，切换成功后，新主上业务可正常下发|  
|
|  
|  
|主备都开启undo亲和时，带业务的前提下，做failover|主备可切换成功，切换成功后，新主上业务可正常下发|  
|
|  
|  
|主开启undo亲和，备不开启undo亲和，带业务的前提下，做switchover|主备可切换成功，切换成功后，新主上业务可正常下发|  
|
|  
|  
|主开启undo亲和，备不开启undo亲和，带业务的前提下，做failover|主备可切换成功，切换成功后，新主上业务可正常下发|  
|
|  
|  
|主不开启undo亲和，备开启undo亲和，带业务的前提下，做switchover|主备可切换成功，切换成功后，新主上业务可正常下发|  
|
|  
|  
|主不开启undo亲和，备开启undo亲和，带业务的前提下，做failover|主备可切换成功，切换成功后，新主上业务可正常下发|  
|
|  
|  
|主备都开启undo亲和时，带业务的前提下，做多次switchover|多次switchover中，主备都可切换成功，切换成功后，新主上业务可正常下发|  
|
|  
|  
|主备都开启undo亲和时，带业务的前提下，做多次failover|多次failover中，主备都可切换成功，切换成功后，新主上业务可正常下发|  
|


### 3.3.10 和长稳的交互  ，针对这一功能点的测试

**说明：**  这部分主要是防止需求上车后，SIT长稳出现该特性相关需求，优先级可放低，使用已有典型长稳用例跑该特性3*24h.

已有用例如下：

长稳功能模型：    [https://jenkins.yasdb.com/view/master/view/master_L3_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/master_L3_cluster_heap_Stability_self_build/](https://jenkins.yasdb.com/view/master/view/master_L3_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/master_L3_cluster_heap_Stability_self_build/)  

长稳tpcc模型：    [https://jenkins.yasdb.com/view/master/view/master_L3_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/master_L3_cluster_heap_Stability_tpcc/](https://jenkins.yasdb.com/view/master/view/master_L3_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/master_L3_cluster_heap_Stability_tpcc/)  

### 3.3.11 和一致性的交互  ，针对这一功能点的测试

**说明：**  这该特性涉及故障以及一致性读等操作，所以一致性需要验证，复用已有一致性用例即可。

已有用例如下：

  [https://jenkins.yasdb.com/user/hezhiwei/my-views/view/](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/)    zlh%E5%BE%85%E5%A4%8D%E5%88%B6%E5%B7%A5%E7%A8%8B/job/Agile_L3_cluster_heap_KT_TX_1_arm_copy_zlh/

  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


  


# 5. 测试框架设计

- 已有测试框架可满足需求，不需要新增测试框架及接口


# 6. 测试环境说明

  


|测试类型|环境|备注|
|---|---|---|
|功能测试|本地X86+ARM虚拟机环境|CentOS 16U 32G   其它未做说明测试项默认都使用功能测试环境|
|性能测试|52/53/54/55环境|  
|
|RTO测试|52/53/54/55环境|  
|
|长稳测试|长稳专项机器|  
|


# 7. 工作量评估

工作量：总计34人/天（7人/周），当前已投2.5人/天，剩余31.5人/天工作量

转测时间：2024/11/7

计划测试完成时间：2024/12/10（亚娜投到2024/11/26）

涉及用例总数：1479个

实际测试完成时间：xxxx/xx/xx

实际投入工作量：xx人/周

|工作项|子工作项|时间成本|备注|
|---|---|---|---|
|需求调研+开发串讲|  
|1人/天|pass|
|测试设计输出及细节沟通对齐|  
|1人/天|pass|
|测试设计评审|  
|0.5人/天|pass|
|测试用例输出|  
|1人/天|pass|
|测试用例自动化|配置参数相关用例|1人/天|pass|
|  
|已有功能用例|0人/天|pass|
|  
|动态视图相关用例|2人/天|pass|
|  
|实例启停/并发启停|1人/天|pass|
|  
|资源迁移和资源访问并发|1人/天|pass|
|  
|集群HA相关用例|1人/天|pass|
|测试执行|配置参数相关用例|1人/天|  
pass|
|  
|已有功能用例|1人/天|pass  
|
|  
|动态视图相关用例|2人/天|  
90%，剩单点场景，待开发提供场景构造方式|
|  
|实例启停/并发启停|3人/天（2+1）|  
80%，剩单点场景|
|  
|资源迁移和资源访问并发|3人/天|  
pass|
|  
|集群HA相关用例|2人/天|尚未投入  
|
|  
|性能测试|2人/天|10%|
|  
|rto测试|2人/天|  
pass|
|  
|长稳测试|3人/天|pass  
|
|  
|一致性测试|1人/天|  
pass|
|问题单定位跟踪回归|  
|3人/天|尚未投入|
|CI工程新增和沟通对齐|  
|0人/天|尚未投入  
|
|需求上车|  
|1人/天|尚未投入  
|


# 8. 测试用例维护

|测试项|框架|目录|调度|备注|
|---|---|---|---|---|
|配置参数相关用例|yasft|global_memory\grc\object_manager\ght\_UNDO_AFFINITY\node2|/|用例放在2层|
|  
|ha|ha_cluster/testcase/common/global_memory/grc/object_manager/ght/node2|schedule_DB_3|并发场景使用ha|
|动态视图相关用例|yasft|system_view\dynamic_view\x_view\x_GRC_OBJECT,system_view\dynamic_view\v_view\v_GRC_AFFINITY_POLICY,system_view\dynamic_view\gv_view\gv_GRC_AFFINITY_POLICY,system_view\dynamic_view\ft_view\ft_GRC_OBJ_RES,system_view\dynamic_view\ft_view\ft_GRC_OBJ_REQ,system_view\dynamic_view\ft_view\ft_GRC_OBJ_PC|  
|用例放在2层|
|  
|ha|ha_cluster/testcase/common/system_view/dynamic_view/x_GRC_OBJECT,ha_cluster/testcase/common/system_view/dynamic_view/v_GRC_AFFINITY_POLICY,ha_cluster/testcase/common/system_view/dynamic_view/gv_GRC_AFFINITY_POLICY,ha_cluster/testcase/common/system_view/dynamic_view/ft_GRC_OBJ_RES,ha_cluster/testcase/common/system_view/dynamic_view/ft_GRC_OBJ_REQ,ha_cluster/testcase/common/system_view/dynamic_view/ft_GRC_OBJ_PC|2节点：,schedule_DB_3,4节点：,schedule_DB_4|用例放在3层|
|实例启停/故障相关用例|ha|ha_cluster/testcase/common/storage/undo_affinity/basic|2节点：,schedule_DB_3,4节点：,schedule_DB_4|用例放在3层|
|资源迁移和资源访问并发|ha|ha_cluster/testcase/common/storage/undo_affinity/migrate|同上|同上|
|集群ha|ha|ha_cluster/testcase/common/storage/undo_affinity/cluster_ha|schedule_ha_L3_4|同上|


# 9. 上车分析

工程总链接：  [https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/%E4%B8%8A%E8%BD%A6%E5%B7%A5%E7%A8%8B%E5%85%A5%E5%8F%A3/job/Agile_master_L2_Build/5717](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/%E4%B8%8A%E8%BD%A6%E5%B7%A5%E7%A8%8B%E5%85%A5%E5%8F%A3/job/Agile_master_L2_Build/5717)  /

|工程链接|失败用例|失败原因|解决方案|当前状态|
|---|---|---|---|---|
|单机|||||
|  [https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/4737](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/4737)  /|test_sdv_SR15300_014|删除数据时未识别到where关键字|没找到原因,  [https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm)  /,4762，last fail pass|pass|
||test_ydbrd_26180_incline_02|结果和预期不一致|没找到原因,4762，last fail pass|pass|
||test_ydbrd_5180_partition_update_008_3,test_ydbrd_5180_partition_update_009_3|结果和预期不一致|和主干相同失败，忽略|pass|
||test_sit_ntb4268_230,test_sit_ntb4268_231,test_sit_ntb4268_232|结果和预期不一致|没找到原因,4762，last fail pass|pass|
|  [https://jenkins.yasdb.com/job/Agile_L2_sa_tac_HA_2_docker/5563](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_HA_2_docker/5563)  /|test_sdv_ha_parallelBuild_14|用例偶现失败，和环境有关系|last fail,  [https://jenkins.yasdb.com/job/Agile_L2_sa_tac_HA_2_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_HA_2_docker)  /,5577||
|  [https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/4032](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/4032)  /|test_sdv_multi_table_update_sub|global memory 空间不足|和主干相同失败，忽略|pass|
||test_sdv_filter_in_78|聚合函数查询时报错|和主干相同失败，忽略|pass|
||test_ydbrd_5180_partition_update_008_3,test_ydbrd_5180_partition_update_009_3|结果和预期不一致|和主干相同失败，忽略|pass|
|  [https://jenkins.yasdb.com/job/Agile_L2_sa_yasft_code_sensitive_arm/168](https://jenkins.yasdb.com/job/Agile_L2_sa_yasft_code_sensitive_arm/168)  /|test_sdv_ydbrd_15209_03|该需求新增fix_table，导致对应视图发生变化|需求上车后需要刷新预期|上车后刷新预期|
||test_sdv_sysview_mysql_function_01|查询结果串行|和主干相同失败，忽略|pass|
|集群|||||
|  [https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/4145](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/4145)  /|||执行超时，last fail执行中,  [https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/4167](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/4167)  /,CI机器资源不足，继续重新执行中,  [https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/4170](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/4170)  /|TBD|
|  [https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_yfs_arm/3474](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_yfs_arm/3474)  /|test_yfs_online_parameters_YDBRD_21455_01_pre,test_yfs_online_parameters_YDBRD_21455_01_post,test_sdv_cluster_yfscmd_dirmanager_002|ycs启动时未启动成功|和主干相同失败，忽略|pass|
|  [https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_code_sensitive_arm/150](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_code_sensitive_arm/150)  /|test_sdv_ydbrd_13415_gls_resource_scene_010,test_sdv_ydbrd_13415_gls_resource_scene_011,test_sdv_ydbrd_15209_01_rac,test_sdv_ydbrd_15209_03_rac,test_sdv_ydbrd_15209_04_rac|该需求新增fix_table，导致对应视图发生变化|需求上车后需要刷新预期|上车后刷新预期|
|分布式|||||
|  [https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/3524](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/3524)  /|ydbrd_26165_mcol_disable_018_3,ydbrd_26165_mcol_disable_019_1,ydbrd_26165_mcol_disable_019_3,ydbrd_26165_mcol_disable_020_3|删表时出现锁超时现象,偶现问题，跑last fail,  [https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/3540](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/3540)  /,last fail pass||pass|
|  [https://jenkins.yasdb.com/job/Agile_L2_dst_pn_TX_arm/86](https://jenkins.yasdb.com/job/Agile_L2_dst_pn_TX_arm/86)  /||CII机器资源不足|重跑,  [https://jenkins.yasdb.com/job/Agile_L2_dst_pn_TX_arm](https://jenkins.yasdb.com/job/Agile_L2_dst_pn_TX_arm)  /,95,特性不稳定用例，CI未适配测试报告展示|pass|
|  [https://jenkins.yasdb.com/job/Agile_L2_dst_yasft_code_sensitive_arm/152](https://jenkins.yasdb.com/job/Agile_L2_dst_yasft_code_sensitive_arm/152)  /|test_sdv_ydbrd_15209_03,test_sdv_ydbrd_15209_04|该需求新增fix_table，导致对应视图发生变化|需求上车后需要刷新预期|上车后刷新预期|
||test_sdv_ydbrd_15210_SESSION_ROLES|创建对象时报错对象已存在|建议跑 fail,  [https://jenkins.yasdb.com/job/Agile_L2_dst_yasft_code_sensitive_arm](https://jenkins.yasdb.com/job/Agile_L2_dst_yasft_code_sensitive_arm)  /,168，last fail pass|pass|
|  [https://jenkins.yasdb.com/job/Agile_L2_dst_pn_yasft_arm/93](https://jenkins.yasdb.com/job/Agile_L2_dst_pn_yasft_arm/93)  /||工程执行超时，正在重新执行中,  [https://jenkins.yasdb.com/job/Agile_L2_dst_pn_yasft_arm/104](https://jenkins.yasdb.com/job/Agile_L2_dst_pn_yasft_arm/104)  /,  [https://jenkins.yasdb.com/job/Agile_L2_dst_pn_yasft_arm/107](https://jenkins.yasdb.com/job/Agile_L2_dst_pn_yasft_arm/107)  /||pass|
|  [https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yaskt_arm/190](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yaskt_arm/190)  /|KT_LSC_1_32_32|oom|忽略，偶现问题|pass|


# 10. TBD  


  


## Comments:

|  [](null)  ,问题记录：,1、本地亲和性如何理解？    
  A：本实例访问本实例管理的undo相关对象，这种场景下，原则上是会有性能提升的    
  2、"undo亲和管理仅针对于实例undo表空间下管理的对象，而不是整个表空间层面"怎么理解？    
  A：undo亲和管理是基于对象的管理，不是基于表空间层面的管理，即undo表空间下有多个对象，每个对象都有自己的ObjID，并不是一个undo对应一个ObjID    
  3、为什么"临时表空间UNDO属于全局分配资源"？    
  A：临时表空间对象，所有的对象共享同一undo表空间，做不到实例级亲和特点。4、"每个实例的UNDO对象具备全局唯一的dataOid。 同一个表空间下的undo对象共享相同的dataOid"如何理解？    
  A：每个实例只有1个undo，每个undo只有一个ObjID    
  5、"OHT"的迁移本质上属于partition的迁移    
  A：其实就是Objet的迁移    
  6、"OHT资源迁移仍然保持实例亲和的特点"，如何理解？    
  A：迁移前，对象1的亲和实例是实例1，此刻，实例1故障，那实例1上的资源对象1会被迁移到存活实例实例2上，此刻对象1的亲和实例还是实例1；当实例1故障恢复后，对象1会被再次迁移到实例1上，此刻对象1的亲和实例还是实例1    
  7、XA事务如何理解？    
  A：分布式事务    
  8、"TPCC下的事务属于常驻内存页"，如何理解？    
  A：undo会被加载进内存，一直不被淘汰，所以不会有新的读取    
  9、亲和实例是指什么？对象的master？    
  A：对    
  10、当前实例故障时，该实例上的对象如何被别的实例托管？    
  A：依旧以OHT的方式被别的实例托管，以整个表空间为单位进行托管    
  11、关闭undo亲和时，设置undo的亲和策略，表现是什么？    
  A：需要拦截或者有相关报错    
  12、先设置undo亲和，给对象设置亲和策略，使用一段时间后，再关闭undo亲和，然后再次执行业务，此刻的表现会是什么样子？    
  A：按照新的策略来执行，undo的亲和策略变为默认值    
  13、当前undo对象亲和，是不是没有入口手动指定亲和实例是哪个？默认设置亲和实例是自己？只能通过配置参数来设置？参数设置为TRUE时，亲和策略为affinity；参数设置为false时，亲和策略为default？    
  A：对    
  14、本地亲和性怎么理解，为什么会有性能提升？机制层面有做什么单独处理吗？    
  A：机制层面会做处理，如果是读本地undo，那就直接读，不会走远端，减少了消息开销以及消息需要的网络开销    
  15、当前是不是没有各种设置亲和策略的语法了？    
  A：对,16、实例故障并不会触发资源迁移的原因？,A：实例故障时，走的是资源重分布，未故障的实例上的资源也会被打散重新分配；但是实例停止时，走的是资源迁移，未停止的实例上的原有资源不会涉及到更改,Posted by zhanglihong at 十一月 04, 2024 18:11|
|---|


