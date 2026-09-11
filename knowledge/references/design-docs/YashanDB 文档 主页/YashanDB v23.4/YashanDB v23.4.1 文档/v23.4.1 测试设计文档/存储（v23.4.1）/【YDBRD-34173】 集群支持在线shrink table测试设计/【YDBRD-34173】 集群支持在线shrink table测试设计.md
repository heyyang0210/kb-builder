SR链接：  [https://pingcode.yasdb.com/pjm/items/670dd723e489dd0868f78892?](https://pingcode.yasdb.com/pjm/items/670dd723e489dd0868f78892?)  

#YDBRD-34173 集群支持在线shrink table

# 1. 概述

集群支持Shrink Table，保证其他的实例的并发Insert都能按照顺序查找空间空间的方式，将数据主动插入到Segment内靠前的位置上。

当前版本单机已支持Shrink Table，并且是通过SsmDict的compacting标记来通知并发的DML进行顺序插入。

当前版本集群不支持Shrink Table，因为compacting是内存标记，无法同步到其他实例。

当前的实现是对集群下进行compacting标记的同步，清理进行设计，实现集群下的Shrink Table。

# 2. 需求分析

## 2.1 功能点分析

集群下支持Shrink Table是内存标记的同步与清理。采用事务加内存同步共同控制。

集群实例的内存同步通过消息同步，在表的排他锁内同步其他实例。

内存清理通过事务来控制：

Shrink Segment前起事务，并在HeapSegBlock上登记Xid，以及OpCode。并在extents的锁内同步其他实例。

当Shrink结束，结束事务，并清理页面上的OpCode，其他实例看到OpCode变成Invalid，自动清理内存标记。

当发起Shrink的实例未结束就退出，事务本身也会回滚最终结束，当其他实例看到内存上的compacting标记，需要主动检测对应的事务是否已经结束，因此不需要在reform的流程中做特殊处理。



1、compacting同步：执行shrink的实例会把compacting标记同步给其他实例

- 如果实例上DC未加载，则跳过同步，后续dc加载后，加载search entry(dcReloadSsmDict)的时候会通过current页面上的opcode同步标记
- 如果实例上的dc同步后被淘汰，再次加载后，也可以通过dcReloadSsmDict同步标记


2、并发insert

- 通过内存标记进行控制，当看到内存上的compacting标记，进入sequence search，并且查看segment block上的OpCode是否变成Invalid，则主动清理内存标记。
- 因为Insert都会通过Segment Block获取高水位线，同时检测一下Opcode，进行主动清理。因此在正常结束Shrink之后，不需要通过消息同步清理其他实例的内存标记。


3、事务回滚

- 当发起Shrink的Session出错结束，Shrink的事务会回滚，回滚则清理页面上的OpCode为Invalid。


4、异常处理

    当发起Shrink的实例退出，发起Shrink的主事务就会回滚，事务回滚的时间可能很长，为了减少对其他实例插入数据的影响，我们在看到OpCode是Valid时:

- 主动检测Xid对应的事务是否在回滚的List中，并且记录当前的Topo Version，后续如果发现OpCode是Valid，检测TopoVersion是否变化即可，如果变化了，则主动检测一遍Xid是否在回滚的队列


对于已经处在回滚队列中的事务，主动清理内存标记，至于页面标记，交给回滚操作处理。

- 重启回滚过程中，Shrink的事务还未回滚完，前台Session发起新的Shrink，可以直接修改SegmentBlock，后台事务回滚到Shrink的Undo时，会检测页面上的Xid是否还是之前的Xid，如果不是，则不会修改页面。




## 2.2 应用场景

需求本身的主要应用场景：系统运行一段时间以后，数据做过增删改查，segement存在一定的空洞，为了减少数据碎片，并且释放空间，需要进行shrink table

需求与其他特性的关联场景：跟事务、集群故障恢复存在交互

## 2.3 规格约束

- 单机shrink过程中insert是走的顺序查找， 集群依然走的是随机查找，在shrink过程中如果有并发insert，最终shrink后的效果可能不如单机


# 3. 详细测试设计

## 3.1 测试设计方法

主要采用场景法，对集群shrink table 过程中可能存在的场景进行设计

1、基本的功能、语法，直接复用单机即可，历史用例目录：storage/shrink_table/heap

2、集群状态正常的情况下，shrink table 的过程中， 各个实例做dml操作

3、集群执行shrink table操作时并发实例的加入和退出。

4、有实例故障、正在启动的状态下 做shrink table

5、增加Ssm Dict视图，展示Dict上的标记，Ssm Search Entry信息，对标记位的同步进行验证

## 3.2 详细测试设计

测试范围：

- 表类型：普通表、分区表（一级、二级）
- 数据分布：数据松散、数据紧凑
- 行：普通行，行链接，行迁移
- 表规格：大表、小表




1、详细功能测试点

|测试点|详细测试点|预期|备注|
|---|---|---|---|
|新增功能交互场景（单机和集群都补充）|节点0执行shrink，节点1，节点2，检验是否生效|所有实例查询dba_segment空间占用都为shrink后的最新值， 不同实例shrink都可以正常做dml、select操作，shrink 后其他shrink继续做shrink操作功能依然正常||
||表上带有触发器shrink table|不触发触发器||
||集群做shrink table后做附加日志的解析|附加日志可以正常解析|集群附加日志已有用例覆盖，直接拿来跑即可|
||存在外键级联的场景下，对父表做shrink table|子表不会变更||
||结合嵌套表，表中有udt数据类型|||
||表中有结合lob（行内和行外），数据有行链接，表有split和merge操作，进行shrink table，shrink后再做split和merge操作|||
||shrink table会释放内存中已经申请的block id，session不退出的继续insert会重新查找新的空间block|||
|标记位同步（集群）|实例1发起Shrink，实例2已经打开过表的DC，内存可以看到标记同步|||
||实例1发起Shrink，实例2没有打开表的dc则查看不到同步标记位，后续打开dc后插入数据，内存标记同步||如果实例上DC未加载，则跳过同步，后续dc加载后，加载search entry(dcReloadSsmDict)的时候会通过current页面上的opcode同步标记|
||实例1发起Shrink，实例2的DC已经被淘汰，再次加载后，可以看到同步标记||如果实例上的dc同步后被淘汰，再次加载后，也可以通过dcReloadSsmDict同步标记|
||实例1Shrink结束，实例1会立即清理，实例2不会立即清理，而是在某次Insert或者（update出现行链接或者迁移）时触发标记清理，delete和update原地更新不会触发标记位清理|,||
||实例1发起shrink ，shrink的过程中 实例1被kill， kill后实例2也不会立马清理， 清理时机同正常结束|||
||实例1 发起shrink ，实例1结束后，实例3还未触发标记位清理，实例2 做了dml 后又发起shrink， 实例3 内存标记位会重新同步成实例2发起的新的标记位|实例2shrink结束后，实例3做insert会触发标记位清理||
|故障场景（集群）|shrink table 的过程中（有并发dml），非 shrink实例退出（1个节点或者多个节点）|shrink不会受影响，实例恢复后，查询数据也正确，可以正常做dml||
||shrink table 的过程中（有并发dml），shrink 所在的实例退出（1个节点或者多个节点）|shrink 会回滚，在回滚过程中，其他实例可以继续做shrink 操作，也可以并发做dml，数据没有异常||
||有实例正在shutdown状态，执行shrink table|可以正常执行shrink||
||有实例已经退出集群后，执行shrink table|可以正常执行shrink||
||shrink table 的过程中，有实例恢复加入集群并执行dml|shrink 和dml并发正常,实例恢复后，未执行insert前查询不到标记位，insert后可以加载标记位||
|并发(CT/KT) （集群）|shrink table 和 多个实例并发dml，并发查询（普通查询，闪回查询）、并发查询dba_segements|shrink table和dml业务成功，最终数据正确,过程中查询的数据正确|业务包含：,insert：普通insert，insert批插 ；delete；update,insert和update覆盖行链接和行迁移|
|一致性（集群）|shrink table和dml并发（dml为多实例并发）|不会出现不一致问题||
|长稳（集群）|选择长稳dml变更比较多的表，隔一段时间做一下shrink table|||
|升级（单机、集群）|低版本建表插入数据做dml构造空洞后，升级到当前版本后做shrink操作|高版本shrink操作成功，数据也正确||
||低版本建表插入数据做dml构造空洞，升级后再做一些dml操作，add partion操作后再做shrink操作|高版本shrink操作成功，数据也正确||
|性能（集群）|跟单机shrink table的速率做对比|1、没有并发dml,2、有少量并发dml|shrink过程中commit 是wait方式，单机是commit nowait|


2、DFX覆盖

|系统级DFX分类|是否涉及|
|---|---|
|CT|涉及|
|KT|涉及|
|长稳|涉及|
|一致性|涉及|
|三方测试工具  
(sqltest，sqlancer)|  
不涉及|
|安全|  
不涉及|
|DFR|  
不涉及|
|HA|  
不涉及|
|压力|不涉及  
|
|性能|涉及  
|
|可维护性|  
涉及（升级、资料）|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；


|SR编号|SR名称|用例编号|用例测试点|
|:---|:---|:---|:---|
|YDBRD-34173|集群支持shrink table|test_ydbrd_34173_shrink_table_001|1. 跨实例内存标记同步： 
    1. 实例1发起Shrink，实例2内存可以看到标记同步
    1. 实例1发起Shrink，实例2没有打开表的dc，后续打开dc后插入数据，内存标记同步
|
|YDBRD-34173|集群支持shrink table|test_ydbrd_34173_shrink_table_002|内存标记清理：实例1Shrink结束，实例2不会立即清理，而是在某次Insert时触发标记清理|
|YDBRD-34173|集群支持shrink table|test_ydbrd_34173_shrink_table_003|异常场景清理：发起Shrink的实例1 Kill后重启，实例2发起一次Insert观测到内存标记清理|
|YDBRD-34173|集群支持shrink table|test_ydbrd_34173_shrink_table_004|单机的shrink 基本功能用例在集群连跑成功|


    2.启动测试之前提供文本用例，并完成大部分自动化用例；

  [集群支持shrink _table.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjdjNTdmZWYzOTgyM2YyYWMxZjI2MzMyIiwicmVmX2lkIjoiNjc2YTJmMDJkMmJhZmYwZmQ1NWViZTQxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU5Mzk4LCJleHAiOjE3ODI1NDU3OTh9.xuyoGqlRvG2qXdPklSpdQxtXY1wAb3WumnTeYUjGOkw)  

# 5. 测试框架设计

- 基本功能使用guider框架跑yasft用例即可
- 一致性使用guider框架跑yastx
- 并发使用guider框架跑yasct/yastx
- 对于故障恢复精准看护的用例，使用ha框架


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *10人天*

*测试设计+用例自动化6人天*

*执行 3人天*

*上车分析 预期刷新 1人天*

计划测试完成时间：



