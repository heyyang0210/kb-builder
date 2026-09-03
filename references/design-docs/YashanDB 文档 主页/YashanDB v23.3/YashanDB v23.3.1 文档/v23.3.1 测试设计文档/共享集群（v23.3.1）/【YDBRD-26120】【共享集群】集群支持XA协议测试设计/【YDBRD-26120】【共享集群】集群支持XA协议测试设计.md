Created by 牛亚娜, last modified on 八月 27, 2024

# 1. 概述

XA 协议是由 X/Open 组织提出的分布式事务处理规范，主要定义了事务管理器 TM 和局部资源管理器 RM 之间的接口。目前单机已经在存储模块上支持了XA接口，由于集群也有联合多个节点执行事务的需求，因而需要集群具备XA事务能力，其中典型的应用如DBLINK能力，通过XA协议来连接同构或异构数据库，在多个节点上执行同一个事务。

本地事务一般只发生在一个数据库中，通过同一套事务管理机制进行管理，不涉及节点间的协调和合作，机制实现上较为简单。分布式事务相比于本地事务而言，出现了跨节点的情况，需要服务与服务之间远程协作才能完成事务操作，提交成功的条件更为严格，需要异常处理也变得复杂起来。业界分布式事务一般通过2PC或者3PC解决分布式提交的问题，然而不同厂商间的分布式事务实现方式千差万别，为了统一分布式事务的接口使用，XA协议应运而生。它是一个规范化的2PC协议，目前主流的数据库，如oracle、DB2 都是支持 XA 协议的。

支持XA协议后，数据库上层的业务可以以较小的代价对多个同构或异构数据库进行事务的控制，保证事务ACID属性，从而简化业务模型，提高系统的健壮性和业务复杂性。

目前，单机已在存储上支持XA协议接口，本次需求需要支持共享集群形态部署的XA协议接口，以满足共享集群下的XA协议通信。

# 2. 需求分析

## 2.1 功能点分析

### 2.1.1 支持XA协议基本功能

1. 提供XA事务的启动、挂起、恢复、一阶段提交、二阶段提交、普通回滚、二阶段回滚功能
1. 提供事务上下文与线程的绑定、游离、恢复绑定能力


|接口|实现要点|是否落地|是否允许跨实例|
|:---|:---|:---|:---|
|ax_reg|跟随单机|否|不涉及|
|ax_unreg|跟随单机|否|不涉及|
|xa_open|跟随单机，直接返回成功|是|不涉及|
|xa_close|跟随单机，直接返回成功|是|不涉及|
|xa_start|需要在全局和本地Gtid绑定，不允许跨实例，其它跟随单机|是|不允许|
|xa_end|需要在全局和本地Gtid游离，不允许跨实例，其它跟随单机|是|不允许|
|xa_preapre|需要在全局和本地Gtid绑定，不允许跨实例，其它跟随单机|是|不允许|
|xa_commit|先本地结束事务，释放本地Gtid资源，再释放全局Gtid资源，允许跨实例，其它跟随单机|是|允许|
|xa_rollback|先本地结束事务，释放本地Gtid资源，再释放全局Gtid资源，允许跨实例，其它跟随单机|是|允许|
|xa_forget|清除启发式结束事务，跟随单机|是|不允许|
|xa_recover|未清理的phase2事务，需要返回全局的未决事务|是|不允许|


![](https://conf.yasdb.com/download/attachments/150627102/1713787978129.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQ0FBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQVFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzIxNjYsImV4cCI6MTc4MjM4Mjk2Nn0.VOEJa5hXioZuEc1sV0kEkK2cwUXVkvFgtqW5QtftMfM)

#### 优化项功能

1. read-only事务：某节点在收到一阶段的时候，发现自己仅持有了资源，并没有真正修改数据；此时该节点上不需要持久化动作，只需要在一阶段直接释放资源
1. one-phase commit：当TM收集到只有一个节点真正参与事务，则可以选择发送one-phase commit，此时不需要经过一阶段即可直接提交


### 2.1.2 支持XA协议的在线故障恢复

1. 支持实例故障（掉电重启、单实例/多实例）后的未决事务托管，需要恢复XA事务能力，除了持久化内容，还需要保证未结束的XA事务恢复后，恢复所持有的资源
1. 提供recover查询能力，使得TM可通过recover协议查询所有XA事务列表


### 2.1.3 提供视图能力

|视图名称|视图说明|备注|
|:---|:---|:---|
|V$GRC_RESOURCE|显示共享集群全局资源情况,RESOURCE_NAME--新增GTID资源类型：['gtid长度'],TYPE--新增可取值：2,OWNER_COUNT--取值  为0或1,OWNER_MAP--恒为0|已有视图|
|GV$GRC_RESOURCE|显示共享集群全局资源情况|已有视图|
|V$2PC_PENDING|显示未决事务相关信息及其状态|已有视图|
|GV$2PC_PENDING|显示  全部实例上的  未决事务  相关信息及其状态|新增视图|


## 2.2 应用场景

- 适用于需要确保分布式系统中数据操作的一致性和可靠性的各种场景。通过XA事务，可以有效地管理和协调跨多个资源管理器的复杂事务操作，保证系统在各种条件下的正确性和可靠性


## 2.3 规格约束

- 单实例上的表现，与单机相同
- 涉及跨实例场景：
-     1. XaStart、XaEnd、XaPrepare，xa_forget，xa_recover不允许跨实例
    1. XaCommit、XaRollback允许跨实例

- XA事务数上限为24K个(ANK_MAX_HANDLERS + ANK_MAX_PENDING_TRANS)  【8k页面： 1 * 51 * 32 * 1024 个XA事务；16k页面：2 * 51 * 32 * 1024 个XA事务；32k页面：4 * 51 * 32 * 1024 个XA事务】
- 当XaPrepare前发生故障，事务回滚，当XaPrepare后，不管是哪个实例故障，未决事务恢复
- 每个实例上未决事务的数量上限为（8K / 最大实例数量）
- 实例个数：2节点和3+节点
- 支持集群主备部署模式（  不支持  ）


# 3. 详细测试设计

## 3.1 测试设计方法

- 边界值测试：验证XA事务数上限，每个实例上未决事务的数量上限
- 路径覆盖：  从XA事务开始的各个环节的状态转换出发，沿着每条路径进行测试覆盖
- 组合测试：测试不同接口的组合使用
- 场景法：考虑集群多实例的架构及消息流的传输，测试基本功能
- 错误分析法：  识别和测试各种可能导致系统失败或错误的情况


## 3.2 详细测试设计

对于单实例上的测试，表现和单机相同，基于单机全量用例进行验证

对于集群新增功能，需要进行针对性的场景设计及验证，主要包含两大类：

- 跨实例进行XA事务，观测实例表现和业务的正确性（消息流）
- 故障场景下进行XA事务，观测未决事务的托管及恢复情况


对于新增视图和视图新增字段值信息的变更，采用公共测试方式，同时结合业务进行测试

|系统级DFX分类|是否涉及|说明|
|:---|:---|:---|
|CT|涉及|该特性涉及  并发控制，需要验证并发场景|
|KT|涉及|该特性涉及故障重启等场景，需要恢复XA事务能力，除了持久化内容，还需要保证未结束的XA事务恢复后，恢复所持有的资源|
|长稳|不涉及|该特性不涉及长稳专项，原则上长稳场景应该不受到影响|
|一致性|涉及|该特性涉及xa事务并发，需要保证数据一致性|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|该特性不涉及新增sql语法|
|安全|不涉及|该特性不涉及用户权限，密码等相关操作的开发 |
|DFR|涉及|该特性涉及故障，故障类型层面需要考虑有代表性的网络故障/重启等|
|HA|涉及|验证集群主备部署模式下的基本场景（switchover，failover场景下的基本验证）|
|压力|不涉及|该特性不涉及压力专项，原则上压力场景应该不受到影响|
|性能|不涉及|该特性不涉及性能专项，原则上性能场景应该不受到影响|
|可维护性|涉及|该特性涉及视图字段的新增以及资料的修改，需要测试|
|RTO|涉及|新增恢复流程：恢复XA事务，观测RTO是否受影响|


### 3.2.1 XA事务路径覆盖时涉及到的测试因子

|测试因子类别|一级分类|二级分类|备注|
|:---|:---|:---|:---|
|是否开启XA事务|开启XA事务|  
|  
|
|  
|未开启XA事务|  
|  
|
|是否带dml操作|从开始到结束，没有任何的dml起事务|  
|  
|
|  
|从开始到结束，有dml起事务|xa_start之前执行dml|xa_start之前执行dml，单机事务转换成分布式事务|
|  
|  
|xa_start和xa_end之间执行dml|xa_start和xa_end之间可以继续执行dml|
|  
|  
|xa_end和xa_prepare之间执行dml|xa_end后分布式事务游离，可以执行单机事务，或者新起分布式事务,xa_end后做的dml属于新的单机或者转换成新的分布式事务,xa_end以后如果有活跃的单机事务，执行prepare会报错，单机事务提交后，可以执行prepare|
|  
|  
|xa_prepare和commit/rollback之间  执行dml|xa_prepare以后dml会报错|
|dml操作类型|insert|  
|  
|
|  
|delete|  
|  
|
|  
|update|  
|  
|
|  
|select   |  
|  
|
|  
|select for update|  
|  
|
|XA事务接口|xa_start|flag：TMNOFLAGS|  
|
|  
|  
|flag：TMJOIN/TMRESUME|  
|
|  
|xa_end|flag：TMSUSPEND等价于noflag|  
|
|  
|  
|flag：TMSUCCESS等价于TMFAIL|  
|
|  
|xa_preapre|  
|  
|
|  
|xa_commit|flag：TMONEPHASE|  
|
|  
|xa_rollback|  
|  
|
|  
|xa_forget|  
|  
|
|  
|xa_recover|  
|  
|


### 3.2.2 集群本身基本功能验证时涉及到的测试因子

|测试因子类别|一级分类|二级分类|备注|
|:---|:---|:---|:---|
|实例个数|2个|  
|  
|
|  
|4个|  
|  
|
|事务下发过程中实例启停的个数|1个|  
|  
|
|  
|2个|  
|  
|
|  
|3个|  
|  
|
|事务下发过程中实例启停的类型|单次启停|  
|  
|
|  
|连续启停|  
|  
|
|事务下发过程中实例故障的个数|1个|  
|  
|
|  
|2个|  
|  
|
|  
|3个|  
|  
|
|事务下发过程中故障/启停的实例角色|master实例|  
|  
|
|  
|非master实例|  
|  
|
|  
|master+非master实例|  
|  
|
|故障的类型|进程故障|kill -9 db/ycs|  
|
|  
|网络故障|网络丢包|  
|
|  
|  
|网络延迟|  
|
|  
|  
|断网卡|  
|
|  
|  
|网络闪断|  
|
|  
|  
|存储网络故障|基本看护，暂不考虑丢包和错包|
|  
|服务器异常|宕机（reboot）|  
|
|故障的次数|单次故障|  
|  
|
|  
|连续同类故障（n次）|  
|  
|
|  
|连续不同类故障|  
|  
|
|事务下发过程中同时发生启停和故障|启动+故障|  
|  
|
|  
|停止+故障|  
|  
|
|  
|启停+故障|  
|  
|
|资源类型|Gtid资源|  
|  
|
|  
|GCS资源|  
|  
|
|  
|GLS资源|  
|  
|
|业务下发的方式|多实例串行|  
|  
|
|  
|多实例并行|  
|  
|


### 3.2.3 场景验证

#### 3.2.3.1 基于角色分布相关场景的测试

这部分需要精确构造RMO角色处于不同实例的场景，然后基于这些场景覆盖XA事务的各种接口，其中穿插dml业务/dml+ddl业务/不带dml业务，主要是串行方式下发业务

|场景|一级分类|预期|备注|
|:---|:---|:---|:---|
|初始状态，owner不存在|RM在同一个实例，执行xaStart|执行成功|  
|
|  
|RM不在同一个实例，执行xaStart|执行成功|  
|
|RMO角色在同一个实例|执行xaStart/  xaEnd/xaPrepare/xaCommit/xaRollback|和单机表现相同，进行路径覆盖|  
|
|RO在同一个实例，M在另一个实例|执行xaStart/  xaEnd/xaPrepare/xaCommit/xaRollback|进行路径覆盖|  
|
|MO在一个实例，R在另一个实例|执行  xaCommit/xaRollback|执行成功|  
|
|RM在一个实例，O在另一个实例|执行  xaCommit/xaRollback|执行成功|  
|
|RMO角色分别在不同实例|执行  xaCommit/xaRollback|执行成功|  
|


将这些场景和前面的因子组合后，得到以下测试点

|  
|场景|XA流程|实例部署个数|xa_start前是否启动单机事务|start和end中间是否穿插dml|xa_end和xa_prepare之间是否执行dml|xa_prepare之后是否执行dml|  
|
|---|---|---|---|---|---|---|---|---|
|1|RMO角色在同一个实例|一阶段提交|2实例|是|是|是|是|  
|
|2|RMO角色在同一个实例|二阶段提交|4实例|否|否|否|否|  
|
|3|RO在同一个实例，M在另一个实例|一阶段提交|4实例|否|是|否|是|  
|
|4|RO在同一个实例，M在另一个实例|二阶段提交|2实例|是|否|是|否|  
|
|5|MO在一个实例，R在另一个实例|普通回滚|2实例|是|是|否|否|  
|
|6|MO在一个实例，R在另一个实例|二阶段回滚|4实例|否|否|是|是|  
|
|7|RM在一个实例，O在另一个实例|普通回滚|2实例|否|否|是|是|  
|
|8|RM在一个实例，O在另一个实例|二阶段回滚|4实例|是|是|否|否|  
|
|9|RMO角色分别在不同实例|一阶段提交|4实例|是|否|否|否|  
|
|10|RMO角色分别在不同实例|二阶段提交|4实例|否|是|是|是|  
|
|11|RMO角色在同一个实例|普通回滚|4实例|是|否|是|是|  
|
|12|RMO角色在同一个实例|二阶段回滚|2实例|否|是|否|否|  
|
|13|RO在同一个实例，M在另一个实例|普通回滚|4实例|否|是|否|是|  
|
|14|RO在同一个实例，M在另一个实例|二阶段回滚|2实例|是|否|是|否|  
|
|15|MO在一个实例，R在另一个实例|一阶段提交|4实例|否|否|是|否|  
|
|16|MO在一个实例，R在另一个实例|二阶段提交|2实例|是|是|否|是|  
|
|17|RM在一个实例，O在另一个实例|一阶段提交|4实例|是|是|是|否|  
|
|18|RM在一个实例，O在另一个实例|二阶段提交|2实例|否|否|否|是|  
|
|19|RMO角色分别在不同实例|普通回滚|4实例|是|否|否|否|  
|
|20|RMO角色分别在不同实例|二阶段回滚|4实例|否|是|是|是|  
|


#### 3.2.3.2 基于消息流分支场景的测试

针对本次新增的消息类型，单点功能场景通过业务层面来构造，故障场景通过打点功能来进行测试（  提供打点  ）

单点功能场景：构造场景可以走到相关消息流

故障场景：模拟在消息流传输的过程中，不同角色的故障（hang/退出），以及故障恢复后，继续下发业务

|消息名称|消息说明|备注|
|:---|:---|:---|
|MSG_XA_REQ|XA请求消息，发给master|  
|
|MSG_ASK_OWNER_DO_XA|master转发请求给owner，执行对应XA请求|  
|
|MSG_XA_REQ_CLOSE|XA的闭环请求，表示该次XA请求结束，GTID资源释放，可以处理下一个请求|  
|
|MSG_XA_ACK|XA的请求消息的应答，包含此次请求的成功与否以及失败原因|  
|


#### 3.2.3.3   故障相关场景的测试

故障部分的测试，主要是验证  在XA事务运行的过程中产生故障的表现，  需要关注：

1、当XaPrepare前发生故障，事务回滚，当XaPrepare后，不管是哪个实例故障，未决事务恢复

2、恢复完成后，通过视图查询到的  GtidResource都是存在owner的

3、  XA状态转换的每个阶段之后触发故障，事务的表现正常

基于3.2.1和3.2.2的测试因子进行正交组合后进行测试

|XA事务中是否带dml操作|实例部署个数|故障实例的个数|故障的角色|故障的类型|故障的次数|业务下发方式|
|:---|:---|:---|:---|:---|:---|:---|
|带dml操作|2实例|1个|master实例|kill -9 db/ycs|单次故障|串行|
|  
|4实例|2个|master+非master实例|kill -9 db/ycs|连续同类故障（n次）|并行|
|  
|2实例|2个|master+非master实例|kill -15 db/ycs|单次故障|串行|
|  
|4实例|1个|master实例|kill -15 db/ycs|连续同类故障（n次）|并行|
|  
|4实例|3个|非master实例|网络丢包|单次故障|串行|
|  
|2实例|1个|master实例|网络丢包|连续同类故障（n次）|并行|
|  
|2实例|1个|非master实例|网络延迟|连续不同类故障|串行|
|  
|4实例|2个|master+非master实例|网络延迟|启动+故障|并行|
|  
|4实例|3个|非master实例|断网卡|连续不同类故障|串行|
|  
|2实例|1个|master实例|断网卡|启动+故障|并行|
|  
|4实例|1个|非master实例|网络闪断|停止+故障|串行|
|  
|2实例|2个|master+非master实例|网络闪断|启停+故障|并行|
|  
|2实例|1个|非master实例|宕机（reboot）|停止+故障|串行|
|  
|4实例|1个|master实例|宕机（reboot）|启停+故障|并行|
|  
|4实例|2个|master+非master实例|kill -9 db/ycs|连续不同类故障|串行|
|  
|2实例|1个|非master实例|kill -15 db/ycs|启动+故障|并行|
|  
|2实例|2个|master实例+非master实例|网络丢包|停止+故障|串行|
|  
|4实例|3个|master+非master实例|网络延迟|启停+故障|并行|
|  
|2实例|2个|master+非master实例|断网卡|启停+故障|串行|
|  
|4实例|3个|非master实例|网络闪断|单次故障|并行|
|  
|2实例|2个|master+非master实例|宕机（reboot）|连续同类故障（n次）|串行|
|  
|2实例|1个|master实例|kill -9 db/ycs|启动+故障|并行|
|  
|4实例|1个|非master实例|网络丢包|连续不同类故障|串行|
|  
|2实例|2个|master+非master实例|kill -15 db/ycs|连续不同类故障|并行|
|  
|4实例|1个|master实例|kill -15 db/ycs|停止+故障|串行|
|  
|2实例|1个|master实例|网络延迟|单次故障|并行|
|  
|4实例|2个|master+非master实例|断网卡|单次故障|串行|
|  
|4实例|1个|非master实例|网络闪断|启动+故障|并行|
|  
|2实例|1个|master+非master实例|网络闪断|连续同类故障（n次）|串行|
|  
|4实例|3个|master+非master实例|宕机（reboot）|连续不同类故障|并行|
|  
|2实例|1个|非master实例|kill -9 db/ycs|停止+故障|串行|
|  
|4实例|1个|非master实例|kill -9 db/ycs|启停+故障|并行|
|  
|4实例|3个|非master实例|kill -15 db/ycs|启停+故障|串行|
|  
|4实例|2个|master+非master实例|网络丢包|启动+故障|并行|
|  
|2实例|1个|master实例|网络丢包|启停+故障|串行|
|  
|4实例|2个|非master实例|网络延迟|连续同类故障（n次）|并行|
|  
|2实例|2个|master+非master实例|网络延迟|停止+故障|串行|
|  
|2实例|1个|非master实例|断网卡|连续同类故障（n次）|并行|
|  
|4实例|3个|master+非master实例|断网卡|停止+故障|串行|
|  
|2实例|2个|master+非master实例|网络闪断|连续不同类故障|并行|
|  
|2实例|1个|非master实例|宕机（reboot）|单次故障|串行|
|  
|4实例|2个|非master实例|宕机（reboot）|启动+故障|并行|
|不带dml操作|2实例|1个|master实例|kill -9 db/ycs|单次故障|  
|
|  
|4实例|2个|master+非master实例|kill -9 db/ycs|连续同类故障（n次）|  
|
|  
|2实例|2个|master+非master实例|kill -15 db/ycs|单次故障|  
|
|  
|4实例|1个|master实例|kill -15 db/ycs|连续同类故障（n次）|  
|
|  
|4实例|3个|非master实例|网络丢包|单次故障|  
|
|  
|2实例|1个|master实例|网络丢包|连续同类故障（n次）|  
|
|  
|2实例|1个|非master实例|网络延迟|连续不同类故障|  
|
|  
|4实例|2个|master+非master实例|网络延迟|启动+故障|  
|
|  
|4实例|3个|非master实例|断网卡|连续不同类故障|  
|
|  
|2实例|1个|master实例|断网卡|启动+故障|  
|
|  
|4实例|1个|非master实例|网络闪断|停止+故障|  
|
|  
|2实例|2个|master+非master实例|网络闪断|启停+故障|  
|
|  
|2实例|1个|非master实例|宕机（reboot）|停止+故障|  
|
|  
|4实例|1个|master实例|宕机（reboot）|启停+故障|  
|
|  
|4实例|2个|master+非master实例|kill -9 db/ycs|连续不同类故障|  
|
|  
|2实例|1个|非master实例|kill -15 db/ycs|启动+故障|  
|
|  
|2实例|2个|master实例+非master实例|网络丢包|停止+故障|  
|
|  
|4实例|3个|master+非master实例|网络延迟|启停+故障|  
|
|  
|2实例|2个|master+非master实例|断网卡|启停+故障|  
|
|  
|4实例|3个|非master实例|网络闪断|单次故障|  
|
|  
|2实例|2个|master+非master实例|宕机（reboot）|连续同类故障（n次）|  
|
|  
|2实例|1个|master实例|kill -9 db/ycs|启动+故障|  
|
|  
|4实例|1个|非master实例|网络丢包|连续不同类故障|  
|
|  
|2实例|2个|master+非master实例|kill -15 db/ycs|连续不同类故障|  
|
|  
|4实例|1个|master实例|kill -15 db/ycs|停止+故障|  
|
|  
|2实例|1个|master实例|网络延迟|单次故障|  
|
|  
|4实例|2个|master+非master实例|断网卡|单次故障|  
|
|  
|4实例|1个|非master实例|网络闪断|启动+故障|  
|
|  
|2实例|1个|master+非master实例|网络闪断|连续同类故障（n次）|  
|
|  
|4实例|3个|master+非master实例|宕机（reboot）|连续不同类故障|  
|
|  
|2实例|1个|非master实例|kill -9 db/ycs|停止+故障|  
|
|  
|4实例|1个|非master实例|kill -9 db/ycs|启停+故障|  
|
|  
|4实例|3个|非master实例|kill -15 db/ycs|启停+故障|  
|
|  
|4实例|2个|master+非master实例|网络丢包|启动+故障|  
|
|  
|2实例|1个|master实例|网络丢包|启停+故障|  
|
|  
|4实例|2个|非master实例|网络延迟|连续同类故障（n次）|  
|
|  
|2实例|2个|master+非master实例|网络延迟|停止+故障|  
|
|  
|2实例|1个|非master实例|断网卡|连续同类故障（n次）|  
|
|  
|4实例|3个|master+非master实例|断网卡|停止+故障|  
|
|  
|2实例|2个|master+非master实例|网络闪断|连续不同类故障|  
|
|  
|2实例|1个|非master实例|宕机（reboot）|单次故障|  
|
|  
|4实例|2个|非master实例|宕机（reboot）|启动+故障|  
|


#### 3.2.3.4 一致性场景

验证在基本功能场景、并发场景下和故障场景下的一致性，基于前面的测试场景进行校验，并增加是否开启语句重启的前提下一致性的验证

#### 3.2.3.5 异常场景

|场景|一级分类|预期|备注|
|:---|:---|:---|:---|
|初始状态，owner不存在|RM在同一个实例，执行  xaEnd/xaPrepare/xaCommit/xaRollback|执行失败|  
|
|  
|RM不在同一个实例，执行  xaEnd/xaPrepare/xaCommit/xaRollback|执行失败|  
|
|MO在一个实例，R在另一个实例|执行xaStart/  xaEnd/xaPrepare|执行失败|  
|
|RM在一个实例，O在另一个实例|执行xaStart/  xaEnd/xaPrepare|执行失败|  
|
|RMO角色分别在不同实例|执行xaStart/  xaEnd/xaPrepare|执行失败|  
|
|不同实例处理相同的GTID|执行xaStart/  xaEnd/xaPrepare|执行失败|  
|


### 3.2.4 视图测试

该特性涉及新增试图和视图中的字段值变更，采用公共项测试方法即可，详细测试点如下：

|场景描述|场景描述|预期|备注|
|:---|:---|:---|:---|
|V$GRC_RESOURCE中字段值信息校验|RESOURCE_NAME--新增GTID资源类型：['gtid长度'],TYPE--新增可取值：2,OWNER_COUNT--取值  为0或1,OWNER_MAP–恒为0,IN_PROCESS,REQUEST_COUNT|  
|关注  Gtid的唯一性|
|GV$GRC_RESOURCE|RESOURCE_NAME--新增GTID资源类型：['gtid长度'],TYPE--新增可取值：,OWNER_COUNT--取值  为0或1,OWNER_MAP--恒为0|  
|  
|
|V$2PC_PENDING|故障场景下，在master查，会显示自身和托管实例的XA事务，在非master查，只显示本实例的XA事务|  
|  
|
|GV$2PC_PENDING|新增视图：在每个实例上查询，可以查到全量的  未决事务信息,1、针对视图本身的名称和字段名称，字段类型定义的规范性做校验，这部分涉及资料，原则上针对目前现有的均不该有变化,2、针对视图的DDL和DML写操作是否做拦截，做校验,3、针对视图的权限做校验，所有用户都有权限查看动态视图（非sys用户访问需要加  Schema  ），非sys用户可创建不同  Schema  下的同名动态视图，非sys用户不加schema不可访问,4、针对视图的基本过滤查询做校验,5、针对每个视图各自定义，看其在各自部署环境上的表象。,6、针对视图中涉及到的每个字段的值的正确性做校验，需构造相应的场景，建立对应的表和字段、字段值来验证值的正确性,7、从业务的角度考虑视图和业务的并发操作，因为查询V$视图本质上是读系统表。执行业务过程中会对相关的系统表做一些读写操作，环环相扣。 因此需要在执行业务过程的同时对相关视图进行查询操作。校验并发过程前中后无core，无hang，无异常报错,8、select查询视图过程中，构造基础故障场景kill -9 实例、断网,9、视图和业务的并发过程中，构造基础故障场景kill -9 实例、断网|  
|  
|
|其它业务校验|进行XA事务操作过程中，并发查询该视图|可正常查询，无core/hang问题|  
|
|  
|进行XA事务操作过程中，并发查询该视图，查询过程中实例故障，故障恢复后继续查询|无core/hang问题|  
|
|资料校验|资料中对于新增试图和视图中的字段值变更的描述信息正确|  
|  
|


# 4. 测试用例

1、测试设计评审时提供冒烟文本用例

  [standalone/testcase/storage/transaction_02/dbms_xa/heap](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/storage/transaction_02/dbms_xa/heap)  

|用例场景|说明|
|:---|:---|
|单节点执行XA事务|基于单机全量用例，验证集群单实例上的表现是否符合预期|
|跨节点执行XA事务|初始状态，owner不存在，RM在同一个实例，执行xaStart成功，执行  xaEnd/xaPrepare/xaCommit/xaRollback失败|
|  
|初始状态，owner不存在，RM不在同一个实例，执行xaStart成功，执行  xaEnd/xaPrepare/xaCommit/xaRollback失败|
|  
|RO在同一个实例，M在另一个实例，执行xaStart/  xaEnd/xaPrepare/xaCommit/xaRollback|
|  
|MO在一个实例，R在另一个实例，执行xaStart/  xaEnd/xaPrepare失败，执行xaCommit/xaRollback成功|
|  
|RM在一个实例，O在另一个实例，执行xaStart/  xaEnd/xaPrepare失败，执行xaCommit/xaRollback成功|
|  
|RMO角色分别在不同实例，执行xaStart/  xaEnd/xaPrepare失败，执行xaCommit/xaRollback成功|
|  
|正常白盒非故障层面的打点由开发来保证（消息类型）|
|  
|执行XA事务的过程中，kill -9 master/非master实例，当XaPrepare前发生故障，事务回滚，当XaPrepare后，不管是哪个实例故障，未决事务恢复|


2、  启动测试之前提供文本用例，并完成大部分自动化用例

[集群支持XA协议文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNzNhMWFkOWEzMzExZGM5NzJiIiwicmVmX2lkIjoiNjczOTZlNzI1OTNmOTljOWZmMjM4NDljIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMTY2LCJleHAiOjE3ODI0NTg1NjZ9.bDW-jGn5QSF-m4HRG0ut9ELuLRBodvJZtnUIhvur3gs)

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

# 8. 上车工程分析

  [Agile_br23.3_L2_Build #40 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/%E4%B8%8A%E8%BD%A6%E5%B7%A5%E7%A8%8B%E5%85%A5%E5%8F%A3/job/Agile_br23.3_L2_Build/40/)  

|  
|失败工程|失败原因|备注|  
|
|---|---|---|---|---|
|1|  [Agile_L2_sa_lsc_HA_4_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_HA_4_docker/4021/)  |  
|  [Agile_L2_sa_lsc_HA_4_docker #4020 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_HA_4_docker/4020/console)  |pass|
|2|  [Agile_L2_sa_lsc_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yasft_arm/3671/)  |XA用例需要替换预期,![](https://pingcode.yasdb.com/atlas/files/public/67396e738970c2af4f5218bc/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQ0FBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQVFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzIxNjYsImV4cCI6MTc4MjM4Mjk2Nn0.VOEJa5hXioZuEc1sV0kEkK2cwUXVkvFgtqW5QtftMfM)|  [YTP (yasdb.com)](https://ytp.yasdb.com/#/buildAnalysis/taskRecordDetail?taskId=ci_task_kwczgXIj&runId=ci_record_R0C6L52o&lastRunId=ci_record_Sxsn6HDE)  |TBD|
|3|  [Agile_L2_sa_upgrade_FT_1_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_upgrade_FT_1_docker/4291/)  |XA用例需要替换预期|  [Allure Report (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_upgrade_FT_1_docker/4289/allure/#packages/d1e97ebee20d5eda6d6a32163e646ceb/5dd1cd989fa86765/)  |TBD需求合入后同步李世铭|
|4|  [Agile_L2_sa_HA_heap_driver_c_arm](https://jenkins.yasdb.com/job/Agile_L2_sa_HA_heap_driver_c_arm/2435/)  |用例和代码不匹配|  [Agile_L2_sa_HA_heap_driver_c_arm #2443 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_HA_heap_driver_c_arm/2443/)  |pass|
|5|  [Agile_L2_sa_heap_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/4091/)  |XA用例需要替换预期,![](https://pingcode.yasdb.com/atlas/files/public/67396e73a1ad9a3311dc972d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQ0FBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQVFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzIxNjYsImV4cCI6MTc4MjM4Mjk2Nn0.VOEJa5hXioZuEc1sV0kEkK2cwUXVkvFgtqW5QtftMfM)|用例没跑够，重跑,  [Agile_L2_sa_heap_yasft_arm #4098 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/4098/console)  ,  [YTP (yasdb.com)](https://ytp.yasdb.com/#/buildAnalysis/taskRecordDetail?taskId=ci_task_PJTvE9nI&runId=ci_record_KZ5l57yy&lastRunId=ci_record_zNzvQfSv)  |TBD|
|6|  [Agile_L2_sa_heap_HA_6_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_6_docker/4747/)  |  
|  [Agile_L2_sa_heap_HA_6_docker #4746 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_6_docker/4746/)  |pass|
|7|  [Agile_L2_sa_upgrade_FT_2_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_upgrade_FT_2_docker/4286/)  |  
|  [Allure Report (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_upgrade_FT_2_docker/4286/allure/#packages/5b9cddefccf9133a3e6f95c1a512db7a/873780c2dd4a455f/)  |TBD需求合入后同步李世铭|
|8|  [Agile_L2_sa_lsc_HA_2_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_HA_2_docker/5173/)  |公共失败问题|  [jenkins.yasdb.com/job/Agile_L2_sa_lsc_HA_2_docker/5173/ha_5freport/](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_HA_2_docker/5173/ha_5freport/)  |pass|
|9|  [Agile_L2_sa_tac_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/3472/)  |  
|重跑,  [Agile_L2_sa_tac_yasft_arm #3481 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/3481/)  |  
|
|10|  [Agile_L2_sa_heap_driver_jdbc_debug_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_driver_jdbc_debug_docker/1729/)  |公共失败问题|  [jenkins.yasdb.com/job/Agile_L2_sa_heap_driver_jdbc_debug_docker/1729/jdbc_5ftest_5freport/](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_driver_jdbc_debug_docker/1729/jdbc_5ftest_5freport/)  |pass|
|11|  [Agile_L2_sa_heap_HA_10_arm](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_10_arm/4/)  |超时|重跑,  [Agile_L2_sa_heap_HA_10_arm #10 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_10_arm/10/)  |pass|
|12|  [Agile_L2_cluster_heap_yasft_sa_case_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_sa_case_arm/3368/)  |  
|  [YTP (yasdb.com)](https://ytp.yasdb.com/#/buildAnalysis/taskRecordDetail?taskId=ci_task_3t2GuTOG&runId=ci_record_RZDvHNw1&lastRunId=ci_record_tZ6NldNt)       无影响|  
|
|13|  [Agile_L2_cluster_yasft_cluster_case_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/3563/)  |gls资源名称变更，修改用例,/system_view/dynamic_view/v_view/GRC_RESOURCE/test_sdv_ydbrd_13415_gls_resource_scene_010    
  /system_view/dynamic_view/v_view/GRC_RESOURCE/test_sdv_ydbrd_13415_gls_resource_scene_011|用例没跑够，重跑,  [Agile_L2_cluster_yasft_cluster_case_arm #3570 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/3570/)  |TBD|
|14|  [Agile_L2_cluster_yasft_ycs_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_ycs_arm/3101/)  |  
|  [YTP (yasdb.com)](https://ytp.yasdb.com/#/buildAnalysis/taskRecordDetail?taskId=ci_task_OcEOkUsp&runId=ci_record_KhWa6mzv&lastRunId=ci_record_JkwJurTl)        无影响|  
|
|15|  [Agile_L2_cluster_yasft_yfs_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_yfs_arm/2983/)  |  
|  [YTP (yasdb.com)](https://ytp.yasdb.com/#/buildAnalysis/taskRecordDetail?taskId=ci_task_rfZxOGjx&runId=ci_record_gAab9D9Y&lastRunId=ci_record_0egf2wqC)        无影响|  
|
|16|  [Agile_L2_cluster_backup_arm_2](https://jenkins.yasdb.com/job/Agile_L2_cluster_backup_arm_2/2768/)  |超时|重跑,  [Agile_L2_cluster_backup_arm_2 #2775 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_backup_arm_2/2775/console)  |pass|
|17|  [Agile_L2_cluster_backup_arm_3](https://jenkins.yasdb.com/job/Agile_L2_cluster_backup_arm_3/1506/)  |超时|重跑,  [Agile_L2_cluster_backup_arm_3 #1513 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_backup_arm_3/1513/console)  ,  [Agile_L2_cluster_backup_arm_3 #1504 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_backup_arm_3/1504/console)  |pass|
|18|  [Agile_L2_cluster_jdbc_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_jdbc_arm/1153/)  |部署失败|  [Agile_L2_cluster_jdbc_arm #1161 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_jdbc_arm/1161/)  |  
|
|19|  [Agile_L2_cluster_ycs_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_ycs_arm/1073/)  |  [jenkins.yasdb.com/job/Agile_L2_cluster_ycs_arm/1073/ha_5freport/](https://jenkins.yasdb.com/job/Agile_L2_cluster_ycs_arm/1073/ha_5freport/)  ,停止实例失败|  [Agile_L2_cluster_ycs_arm #1081 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_ycs_arm/1081/)  ,  [Agile_L2_cluster_ycs_arm #1072 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_ycs_arm/1072/console)  |pass|
|20|  [Agile_L2_cluster_yasft_faultpoint_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_faultpoint_arm/665/)  |  
|  [Agile_L2_cluster_yasft_faultpoint_arm #664 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_faultpoint_arm/664/console)  |pass|
|21|  [Agile_L2_cluster_driver_c_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_driver_c_arm/2422/)  |  
|  [Agile_L2_cluster_driver_c_arm #2430 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_driver_c_arm/2430/)  |  
|
|22|  [Agile_L2_cluster_FT_ha_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_FT_ha_arm/685/)  |  
|  [jenkins.yasdb.com/job/Agile_L2_cluster_FT_ha_arm/685/ha_5freport/](https://jenkins.yasdb.com/job/Agile_L2_cluster_FT_ha_arm/685/ha_5freport/)  |pass|
|23|  [Agile_L2_cluster_yasft_yasboot_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_yasboot_arm/271/)  |用例和代码版本不匹配|无影响|pass|
|24|  [Agile_L2_cluster_heap_yasft_use_native_type_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_use_native_type_arm/627/)  |  
|  [YTP (yasdb.com)](https://ytp.yasdb.com/#/buildAnalysis/taskRecordDetail?taskId=ci_task_3uG2q12r&runId=ci_record_WaPwr2TF&lastRunId=ci_record_ODldqrNt&activity=FT)  |pass|
|25|  [Agile_L2_dst_tac_yasft_32K_arm](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_32K_arm/2365/)  |没跑到用例|重跑,  [Agile_L2_dst_tac_yasft_32K_arm #2374 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_32K_arm/2374/)  |pass|
|26|  [Agile_L2_dst_lsc_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/2966/)  |没跑到用例|重跑,  [Agile_L2_dst_lsc_yasft_arm #2976 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/2976/)  |  
|
|27|  [Agile_L2_dst_tac_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/2752/)  |没跑到用例|重跑,  [Agile_L2_dst_tac_yasft_arm #2761 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/2761/)  |  
|
|28|  [Agile_L2_dst_HA_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_yasft_arm/2229/)  |没跑到用例|重跑,  [Agile_L2_dst_HA_yasft_arm #2238 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_yasft_arm/2238/)  |pass|
|29|  [Agile_L2_dst_om_scale](https://jenkins.yasdb.com/job/Agile_L2_dst_om_scale/2140/)  |  
|  [Agile_L2_dst_om_scale #2147 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_om_scale/2147/)  |pass|
|30|  [Agile_L2_dst_tac_driver_c_docker](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_driver_c_docker/3869/)  |  
|  [Agile_L2_dst_tac_driver_c_docker #3877 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_driver_c_docker/3877/)  |  
|
|31|  [Agile_L2_dst_tac_driver_jdbc_arm](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_driver_jdbc_arm/2570/)  |超时|  [Agile_L2_dst_tac_driver_jdbc_arm #2577 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_driver_jdbc_arm/2577/)  |pass|


## Attachments:

[集群支持XA协议文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNzNhMWFkOWEzMzExZGM5NzJiIiwicmVmX2lkIjoiNjczOTZlNzI1OTNmOTljOWZmMjM4NDljIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMTY2LCJleHAiOjE3ODI0NTg1NjZ9.bDW-jGn5QSF-m4HRG0ut9ELuLRBodvJZtnUIhvur3gs)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,一、会议时间：2024/07/03 16:00-17:00    
  二、会议地点：腾讯会议    
  三、会议主持人：牛亚娜    
  四、参会人员：孟凡彬、陈宜顺、郑荃、张丽红、牛亚娜    
  五、会议主题：集群支持XA协议测试设计评审    
  六、测试评审纪要,规格说明：    
  1、支持xa_forget、xa_recover接口，xa_forget接口不允许跨实例，xa_recover接口不允许跨实例    
  2、XA事务数上限为24K个--实际测试时需要根据max_session参数的最大值控制--为MAX_SESSIONS+8K    
  3、集群主备模式下可以下发XA事务    
  4、xa_start启动XA事务，未执行xa_end时，单实例或者跨实例上继续执行xa_commit/xa_rollback，表现和单机上可能不同    
  （1）当前单机表现：    
  单session/多session执行xa_commit报错    
  单session上执行xa_rollback成功，实际数据回滚成功    
  多session上执行xa_rollback成功，实际数据未回滚    
  （2）当前集群表现：    
  单实例/多实例执行xa_commit报错    
  单实例上执行xa_rollback成功，实例数据未回滚-----表现对齐单机：实际数据回滚成功    
  多实例上执行xa_rollback成功，实例数据未回滚,5、如果本会话开启过xa事务会返回-6（DBMS_RET_XAER_PROTO），GTID已存在是返回-8（DBMS_RET_XAER_DUPID）。两个都场景都有的话，单机优先返回-6，集群是优先返回-8,  
,场景补充：    
  1、集群主备部署模式下，增加switchover/failover后，下发XA事务，正常运行    
  2、残留事务清理校验：    
  （1）db完全故障时，托管事务的实例继续下发业务，可以正常运行    
  （2）恢复完成后，再次把故障db拉起来，继续在故障db下发业务，可以正常运行    
  3、增加业务运行过程中存储网络故障的基本场景看护    
  4、由于故障后新增xa事务的恢复，观测RTO是否受影响,  
,测试侧重点：    
  1、xa_start重点测试noflag场景    
  2、xa_end和xa_prepare非重点，覆盖基本场景测试即可    
  3、xa_commit和xa_rollback涉及跨实例的消息交互，重点测试    
  4、对一个空的XA事务进行PREPARE，这个场景也会涉及XA的集群消息交互，会发COMMIT消息，重点测试    
  5、故障场景：重点关注实例在线恢复和托管的正确性,  
,TBD：    
  提供消息类型的打点--开发,Posted by niuyana at 七月 12, 2024 14:10|
|---|


