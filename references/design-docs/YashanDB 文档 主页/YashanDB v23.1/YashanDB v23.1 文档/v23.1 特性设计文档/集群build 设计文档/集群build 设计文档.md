Created by 张旭涛, last modified on 十月 31, 2023

  


## 1. Overview（概述）

新建集群主备环境，可以使用build 快速建立备库。

## 2. Features（功能特性）

1. 主机支持指定备机IP:PORT 执行build。
1. 主机支持指定备机ID 执行build。
1. 备机支持执行build database，与已连接主机执行build。


## 3. Interfaces（接口）

  


主机端： build database to remote( 'ip:port');

               build database to standby （standyby_name）；   需要附带括号

备机端： build database；

  


## 4. Specification And Constraints（规格与约束）

  


使用约束：

1. 不支持增量build。
1. 不支持repair修复备机。
1. 不支持并行build。


  


集群约束：

1. 主集群端可以在任意实例执行build ，且被build的实例必须是在nomount模式下的master  0号实例角色。
1. 主集群必须打开归档模式。
1. 主集群下只能由一个节点给备集群执行build， 且备集群只能给一个节点执行build。
1. 当前备集群只支持0号节点启动到open模式，其他节点只能启动至nomount或者不启动。


  


## 5. Abnormal scenario（异常场景）

  


1.并发build

与备份一致，主集群无法同时执行build，备集群也无法同时执行build。

2.集群发生reform

主机端发生reform（实例退出集群或加入集群），自动中断build。备集群发生reform，只能是master 节点崩溃（其他节点无法加入集群），build中断。

3.存在节点崩溃，且已经退出集群

崩溃节点的归档和redo信息从ctrl中读取，已生成归档的归档正常备份，在线redo未及时归档的active redo全量备份成归档，current redo按照使用大小备份成在线redo文件（未使用大小是否会造成主备不一致？）

  


## 6. Detail Design（详细设计）

  


集群build实现基于集群的备份恢复。

在主集群执行备份，备集群执行恢复。待db文件传输完毕之后，备机执行recover回放主机归档和redo备份，并转换为备机，然后open。 后续需要手动拉起备集群的其他节点。

  


从主集群端指定to remote 发起build 如下：

备份和build不同点：

备份：

- 主机端执行备份，在记录完rcyend点之后需要切redo，等待current redo文件生成为归档，在每个节点的最后asn的归档文件，为保证回放的一致性点，故只备份记录的rcyend点记录的数据块。


build：

- build模式下，rcyend点记录的归档大小与实际一致，备份成归档文件，超过rcyend记录大小的的按照在线redo格式备份。这种情况仅适用于asn最大的redo（都改成redo），即最后一个redo文件。


在主集群端，备份和build的流程一致。

  


restore 和 备集群build：

备集群的restore过程和单集群一致，数据文件restore完成之后，执行recover open即可。

  


![](https://pingcode.yasdb.com/atlas/files/public/67396b488970c2af4f520352/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFFQUFBQUFBQVFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFJQUJBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTI1OTUsImV4cCI6MTc4MjMwMzM5NX0.hoIrr9rr1p32kAKA6_hQUmWPEFZ-MQemPV910rIhszE)

  


从备集群nomount的master实例发起 build database

从头遍历64个链路链接，主集群的状态是open即可与该主机链路执行build。

## 6. TODO（遗留问题）

  


备份和build 期间 表空间创建互斥、redo增删等互斥尚未支持。

当前无全局标志位标志正在执行备份，故有以下两种方案：

1. 备份过程中，采用消息请求设置各个节点的标志位。   缺点是 如果发生网络断联或者节点启停，对应标志位无法释放。
1. 每次创建表空间、执行备份前。需要遍历各个实例发送消息请求每个节点的标志状态。   缺点是：影响创建表空间的等其他数据文件效率。     优点是：比较稳定，容错率高。


  


![](https://pingcode.yasdb.com/atlas/files/public/67396b48a1ad9a3311dc81c8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFFQUFBQUFBQVFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFJQUJBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTI1OTUsImV4cCI6MTc4MjMwMzM5NX0.hoIrr9rr1p32kAKA6_hQUmWPEFZ-MQemPV910rIhszE)

  


归档注册方案修整：

当前实现：各个节点生成归档，先更新本节点自身内容，并持久化至ctrl文件，然后广播归档注册消息，其他节点收到该归档注册消息之后，更新自己的归档链表。

存在风险：如果生成归档的节点在发送消息过程中挂掉，则会丢失归档信息。

  


修改方案：

实例生成新的归档，获取槽位之前都先重新reload归档的ctrl文件，获取最新的归档信息，然后获取自己归档的槽位，更新当前实例内存中的归档文件链表。最后写入ctrl文件中。

后续其他实例每次注册归档的时候都需要重新reload归档文件。

  


后面不论哪个实例挂掉，在注册归档时候都需要重新load ctrl文件，避免了归档信息丢失。

  


  


## Attachments:

[image2023-4-27_10-47-58.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNDc4OTcwYzJhZjRmNTIwMzRkIiwicmVmX2lkIjoiNjczOTZiNDc3MjgyMDZlZmI5MmYwM2Q3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyNTk1LCJleHAiOjE3ODIzNzg5OTV9.GC8NQ0u931T-SjckciWEJcwXoISDGyX9SQFpZtVZJCU)

 (image/png)    


[image2023-4-27_11-14-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNDdhMWFkOWEzMzExZGM4MWMxIiwicmVmX2lkIjoiNjczOTZiNDc3MjgyMDZlZmI5MmYwM2Q3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyNTk1LCJleHAiOjE3ODIzNzg5OTV9.ShMrYm6dPGajH9ZKiRyuKDNXMPu3R6MNfNoxQz1CbT0)

 (image/png)    


[image2023-4-20_17-31-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNDdhMWFkOWEzMzExZGM4MWMyIiwicmVmX2lkIjoiNjczOTZiNDc3MjgyMDZlZmI5MmYwM2Q3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyNTk1LCJleHAiOjE3ODIzNzg5OTV9.lSEA_fGRPoMhSdC_cEILCO_XDeIEzMcdjzEDw1pprbM)

 (image/png)    


[image2023-4-25_18-41-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNDdhMWFkOWEzMzExZGM4MWMzIiwicmVmX2lkIjoiNjczOTZiNDc3MjgyMDZlZmI5MmYwM2Q3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyNTk1LCJleHAiOjE3ODIzNzg5OTV9.3Ou7aHoRGu-C8xzcjWnEgV2_svfv_z0DtQ6PrFWlThY)

 (image/png)    


[image2023-6-29_11-16-56.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNDc4OTcwYzJhZjRmNTIwMzRlIiwicmVmX2lkIjoiNjczOTZiNDc3MjgyMDZlZmI5MmYwM2Q3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyNTk1LCJleHAiOjE3ODIzNzg5OTV9.IjrZlgB2nx8o2cwZIw4f9Z5TZPEhs1ByjKtKUo1WJP8)

 (image/png)    


[备份与表空间互斥.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNDc4OTcwYzJhZjRmNTIwMzRmIiwicmVmX2lkIjoiNjczOTZiNDc3MjgyMDZlZmI5MmYwM2Q3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyNTk1LCJleHAiOjE3ODIzNzg5OTV9.jeG2LnoVyg49w-h1neMUq3MxLhmX2-IS_rX7DWtTCwM)

 (image/png)    


[备份与表空间互斥.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNDdhMWFkOWEzMzExZGM4MWM1IiwicmVmX2lkIjoiNjczOTZiNDc3MjgyMDZlZmI5MmYwM2Q3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyNTk1LCJleHAiOjE3ODIzNzg5OTV9.MdpR5vA3AD8GUbVvXs2dr9qjSXeFNzm6cN6eZCOE8GU)

 (image/png)    
