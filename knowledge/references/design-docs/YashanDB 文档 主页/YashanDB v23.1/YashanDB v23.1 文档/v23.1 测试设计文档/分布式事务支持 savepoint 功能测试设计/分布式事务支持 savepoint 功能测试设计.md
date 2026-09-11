Created by 施新华, last modified on 六月 25, 2023

# 1.   **概述**

在分布式下，为了增强事务的控制能力，补充 savepoint 能力。savepoint 实际为子事务。用户可以通过 savepoint 回滚到事务中的某个回滚点，而不需要回滚整个事务。

# 2.   **需求分析**

- 功能


分布式下支持 savepoint 功能，用户可以通过在事务内定义若干标记并在需要时将事务恢复到指定标记时的状态。

- 外部接口


--- 创建savepoint   

SAVEPOINT   [  name  ]

--- 删除savepoint   

RELEASE     SAVEPOINT   [  name  ]

--- 回滚到指定savepoint点   

ROLLBACK     TO   (  SAVEPOINT  ) [  name  ]

- 功能约束


1. savepoint的名字必须是在64字节以下。
1. 系统最多支持创建的savepoint数目为maxHandlers+8192个，此外私有pool还可以分配4个。创建savepoint时会先从私有pool中分配，所以即使当前有session报错说savepoint超过上线，另一个session也能分配出4个savepoint。因为各种原因已经释放的savepoint不占额度。如果cn或者dn上建的savepoint数量超过上限，则会报错，不影响事务继续执行。
1. savepoint是事务范围内唯一的，一个savepoint会覆盖前一个同名的savepoint。


- 实现流程


见开发设计文档

# 3.   **测试设计方法**

使用场景测试，结合等价类、边界值进行测试设计。

# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

正常功能：正常场景下，不回滚事务，只回滚 dml 语句；同时事务提交/回滚会清理 savepoint。

使用场景法，基本流：

![](https://pingcode.yasdb.com/atlas/files/public/673969d3a1ad9a3311dc793a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDkyMTQsImV4cCI6MTc4MjIyMDAxNH0.KiJE1TYniQcouipAKAO-q9craKkYnf5HRmj0Qd_zKM8)

在基本流中，结合用户使用场景、规格、异常等，考虑备选流：

基本流：执行事务操作，设置 savepoint，继续执行事务操作，rollback to savepoint，继续执行事务操作，commit；

备选流1：设置 savepoint p1 后，release p1，再 rollback to p1，报错 savepoint 不存在；

备选流2：设置多个 savepoint  后，commit/rollback 事务，在下一个事务中 release p1 或者 rollback to savepoint ，报错 savepoint 不存在；

备选流3：设置多个 savepoint ，rollback to 其中一个 savepoint，覆盖：第一个、中间任意一个、最后一个；回滚成功；

备选流4：以此设置多个 savepoint p1、p2、p3，并依次 rollback to p2、p3、p1; dml 操作回滚正确，rollback to p3 失败，单机可能要刷用例预期； 

备选流5：设置多个同名 savepoint，release savepoint，预期是同名的 savepoint 均被 release 掉；rollback to 被 release 掉的 savepoint 报错； 

备选流6：设置多个同名 savepoint，rollback savepoint，预期是回滚到最后一个同名的 savepoint；

备选流7：事务落在 1 个 dn 节点上，设置 savepoint 后，release/rollback to savepoint；预期成功；

备选流8：事务落在多个 dn 节点上，设置 savepoint 后，release/rollback to savepoint；预期成功；

备选流9：设置 savepoint p1，dml1 落在 dn1 上，设置 savepoint p2，dml2 落在 dn2 上，设置 savepoint p3，dml3 落在 dn3  上，设置 savepoint p4，依次回滚到 p4、p3、p2、p1，dml 回滚正确

备选流10： cn 上启动多个事务，更新同一条记录，等锁，rollback to savepoint 后，回滚成功，预期等锁事务继续等锁；新事务修改同一行记录，不会等锁；对 dn 来说，dml 操作已经全部回滚(等锁事务会拿到锁)、dml 操作部分回滚(等锁事务继续等锁)；

备选流11：设置 savepoint，执行事务操作，rollback to savepoint；预期回滚成功，行锁及表锁的释放，通过 2 张表来覆盖这个测试点；    

备选流12：大事务中设置 savepoint，并执行 rollback to savepoint；---不用测试；

备选流13：release 不存在的 savepoint，报错，事务不回滚

备选流14：rollback to 不存在的 savepoint，报错，事务不回滚

匿名块中 执行 savepoint 功能；—不支持 release savepoint；

上述场景均覆盖验证当前读及已提交读，具体验证方法：

1、当前session 在执行 rollback to savepoint 后，执行一次查询；符合当前读预期；

2、另起一个 session 在执行 rollback to savepoint 后，执行一次查询；符合读已提交隔离级别；

3、事务操作覆盖：增删改

4、预期结果与 oracle 进行比对

  


并发场景分析：

1、设置 savepoint、release savepoint、rollback to savepoint 均为事务内操作，与 session 一对一绑定，不涉及并发；

2、并发事务中，savepoint、release savepoint、rollback to savepoint，功能正确 

  


异常场景分析：

1、dn 节点上残留的 savepoint 不影响下次 rollback to savepoint 功能；

事务发生在多个 dn 上，其中一个 dn 设置 savepoint 失败/cn 上设置 savepoint 失败(非节点故障)，此时 cn 上设置 savepoint 失败，继续执行事务操作，再次设置同名的 savepoint ，并执行 rollback to savepoint；dml 操作回滚正确。

2、cn/dn 节点故障后，事务回滚，savepoint 被清理；—不分接口进行测试，区分：参与事务的 dn、不参与事务的 dn、mn

设置 savepoint 时，cn/dn 节点故障，节点恢复后，设置同名的 savepoint，并执行 rollback to savepoint，dml 操作回滚正确 

rollback to savepoint 失败场景

1、在如下位置设置断点，验证 rollback to savepoint 失败，事务回滚，savepoint 被清理   ----确定断点；

  


接口验证：

savepoint 名字规范验证：中文，长度；

savepoint 个数限制，使用脚本测试；  maxHandlers+8192 + 4 (max_sessions)

  


2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|---|---|
|并发|不涉及|
|长稳|不涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR/testkill|不涉及|
|HA|不涉及|
|压力|不涉及|
|性能|不涉及|
|可维护性|不涉及|


  


# 5.   **测试用例**

测试设计细化后的文本用例

详见附件

# 6.   **测试框架设计**

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 如果需要使用新的测试框架实现用例的自动化，需要在此说明测试框架的架构逻辑及详细设计
1. 如果沿用已有测试框架，需要在此标注测试框架的路径


# 7.   **测试环境说明**

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

  


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZDNhMWFkOWEzMzExZGM3OTM4IiwicmVmX2lkIjoiNjczOTY5ZDM1OTNmOTljOWZmMjM1MzU0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5MjE0LCJleHAiOjE3ODIyOTU2MTR9.K_a4vno0eDktrZ3MwdvHRO0xm2o6RBtEZ75wxI3h1CA)

## Attachments:

[image2023-5-11_18-46-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZDM4OTcwYzJhZjRmNTFmYWMzIiwicmVmX2lkIjoiNjczOTY5ZDM1OTNmOTljOWZmMjM1MzU0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5MjE0LCJleHAiOjE3ODIyOTU2MTR9.9dkao2g9MMMHW_4fIXVNuzicfk1mnli_0OBWWJY5ooU)

 (image/png)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZDNhMWFkOWEzMzExZGM3OTM4IiwicmVmX2lkIjoiNjczOTY5ZDM1OTNmOTljOWZmMjM1MzU0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5MjE0LCJleHAiOjE3ODIyOTU2MTR9.K_a4vno0eDktrZ3MwdvHRO0xm2o6RBtEZ75wxI3h1CA)

 (application/msword)    
