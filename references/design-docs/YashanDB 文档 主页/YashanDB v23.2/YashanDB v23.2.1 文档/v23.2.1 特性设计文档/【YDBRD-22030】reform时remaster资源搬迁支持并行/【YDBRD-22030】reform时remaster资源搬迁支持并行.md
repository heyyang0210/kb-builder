Created by 李佐龙, last modified on 十月 12, 2024

# YDBRD-22030: reform时remaster资源搬迁支持并行

  [[YDBRD-22030] reform时remaster资源搬迁支持并行 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-22030)  

## 1. Overview（概述）

当集群topo发生变化——如DB加入、退出时涉及到资源的重分布，这个过程中可能涉及到资源master的变更，需要将资源从原master迁移到新master。（详细设计参见     [GRC资源重分布与恢复](119554067.html)     ）。 原有的资源迁移是：单个Partition内容分片并串行迁移的，多个Partition间不存在并发迁移。 本需求主要是将原有的资源迁移改造为并行迁移，提高资源迁移并发度，减少资源迁移在reform过程中耗时。

## 2. Features（功能特性）

reform时remaster资源搬迁支持并行。

## 3. Interfaces（接口）

本方案不涉及新增接口

## 4. Specification And Constraints（规格与约束）

## 5. Detail Design（详细设计）

在原有设计基础上（    [GRC资源重分布与恢复](119554067.html)    ），将资源的迁移/释放分散到多个线程：

1. 尽可能启动够多的线程去迁移（最多8个），partition会根据hash值分散到各个线程去搬迁：
    1. 任意线程搬迁出现错误都会标记当前迁移失败，并发送一个信号量
    1. 线程搬迁过程中如果发现已经标记迁移失败，会中止搬迁，并发送一个信号量
    1. 线程成功搬迁结束之后会发送一个信号量
1. 在启动搬迁线程的函数中，通过信号量等待搬迁线程完成（需要等待N次信号量以保证所有线程已退出，N代表启动的搬迁线程个数）
    1. 如果发现未标记迁移失败，则本次并行迁移成功
    1. 如果发现已标记迁移失败，则本次并行迁移存在失败情况，由下一次reform重新触发资源迁移


db启动多个迁移线程，线程之间的协作关系如图所示：

  


![](https://pingcode.yasdb.com/atlas/files/public/67396c6f8970c2af4f520c1c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFDQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBRUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA4NTUsImV4cCI6MTc4MjMxMTY1NX0.Sl0Ia1V-NP_a8hLh7WvydLf6dMXcSUwS2V7AJahynEQ)

## 6. Testcases（自测用例）

1. 功能：部署四实例集群，依次退出各实例，然后依次加入各实例，等reform结束，验证业务能否正常进行。
1. 性能：
    1. 构造一个需要迁移大量资源的场景，测试RTO，与原方案对比
    1. 代码层面大量迁移资源，测试消耗时间，与原方案对比


## 7. 资料设计章节

## 8. TODO（遗留问题）

## Attachments: