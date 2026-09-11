Created by 陈宜顺, last modified on 九月 23, 2024

# 一、背景

集群支持XA事务以后，新增了在线恢复需要托管XA事务的逻辑。由于托管XA事务需要恢复表锁，为了避免出现表锁未恢复前，用户去做一些互斥的操作（比如把表Drop掉等），当前是把表的DDL给禁掉的，一直等到XA事务托管完成为止。这流程修改了在线恢复的逻辑，使得DDL在GRC资源解冻后，仍然受XA事务恢复的阻塞，影响了恢复时间，需要优化。

  


# 二、优化场景

DBMS_XA事务是高级包功能，大多数使用场景都是不带XA事务的，当集群中没有XA事务时，在线恢复可以在GRC解冻后立刻解冻XA事务，放开DDL的操作。

优化思路：增加一种快速判断集群中是否有XA事务需要恢复的机制，如果有XA事务需要恢复，才等待XA事务完成托管，表锁恢复完再放开DDL

  


# 三、优化方案

各实例间精确维护全局的未决XA事务数量

方案要点：

- 实例内存维护所有实例pending状态的XA事务个数
- 增加消息  MSG_SYN_PENDING_XA
- xrmAllocXa成功  之前广播给其他实例同步本实例是否有pending状态的XA事务个数
- xrmDecPendingCount减为零之后广播给其他实例同步本实例已经没有XA事务
- 主实例在线恢复时，根据故障实例是否存在pending状态事务决定是否阻塞表的DDL


可能出现情况：

对方记录本实例存在XA，但是本实例不存在XA的情况，但不存在漏掉拦截的情况，这种情况会导致产生不必要等待的场景，  属于设计范围内的规格

1. 由于  xrmAllocXa在xaEnd的情况下也会调用，有可能出现不准确的情况，这种场景会产生多等待
1. 当  xrmDecPendingCount广播失败后，忽略错误。此时其它实例也可能出现记录存在XA场景。在下一轮广播消息过程中，该问题会进行修正，不影响正确性


  


  


![](https://pingcode.yasdb.com/atlas/files/public/67396ee98970c2af4f521c55/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQWdBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ4MDcsImV4cCI6MTc4MjQ1NTYwN30.s5hrwgIfqwJF02t0ZFZN7ly7JhhXfgjltIk66ixIT0Q)

  


  


## Attachments:

[image2024-9-9_9-9-48.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZTk4OTcwYzJhZjRmNTIxYzUzIiwicmVmX2lkIjoiNjczOTZlZTk3MjgyMDZlZmI5MmYyZTJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0ODA3LCJleHAiOjE3ODI1MzEyMDd9.JLS8soFV2DBkOb54w2QPIC1BH_aVgHQeDbMC5QDOF1s)

 (image/png)    


[image2024-9-7_17-3-33.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZTlhMWFkOWEzMzExZGM5YWM3IiwicmVmX2lkIjoiNjczOTZlZTk3MjgyMDZlZmI5MmYyZTJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0ODA3LCJleHAiOjE3ODI1MzEyMDd9.NbE-6SatiEctEv_tnz78tOmbhaVTXGmqYvBoaRHtm1c)

 (image/png)    
