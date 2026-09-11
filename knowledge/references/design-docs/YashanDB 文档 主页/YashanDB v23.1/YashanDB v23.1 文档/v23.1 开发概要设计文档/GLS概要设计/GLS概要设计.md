Created by 黄杨波, last modified on 十二月 21, 2023

##   [1. 总述](#1-总述)  

在共享集群数据库部署形态下，需要协调控制跨实例间的并发问题（如ddl、dml并发等），而依靠spinLock、latch等只能解决单实例自身的并发问题，无法满足目标。在此背景下，Global Lock Serivce（GLS）诞生了。GLS提供了集群下跨实例的全局并发控制锁服务。

###   [1.1 需求来源](#11-需求来源)  

集群基础能力

###   [1.2 调研文档](#12-调研文档)  

###   [1.3 需求分析](#13-需求分析)  

**功能**

- 请求锁：GLS依托于Global Resource Catalog（GRC）模块进行管理，GRC通过一定的分布式资源管理策略，在各个实例之间管理全局资源元数据，协调各个实例之间的资源排队和访问控制。一个GLS锁通过LockId标识其唯一性，并会由唯一的master进行管理，master协调所有实例对某个GLS锁的访问并记录当前有哪些实例持有GLS锁，权限是X/S。当实例A请求master获取GLS锁时，可以通过master上记录的信息判断锁权限的兼容性，以此来达到控制跨实例间的并发。
- 释放锁：每个实例上的每个GLS Lock都会记录global status和local status两个状态。global status记录的是当前实例在master上登记的权限，即全局状态。local status记录的是当前实例本地使用的权限情况，local status的权限受限于global status，local status不能高于global status，如global status = S，local staus不能为X，只能为S/IDLE。当实例使用完GLS Lock后，释放锁时只会释放local status，不会释放global status。
- 锁升级：某实例GLS Lock global status = S的情况下，去请求master将global status升级成X。
- 锁降级：当请求权限与owner上的权限不兼容时，需要等待owner释放锁，如果发现owner上global status与local status不一致，且local status与请求权限兼容，则直接将owner的global status降级成local status权限，无需等待owner释放锁。锁降级只会被动降级，不会主动降级。
- 支持请求超时：GLS支持请求锁时带有超时机制。即当请求锁权限与owner上的权限不兼容时，需要等待owner释放锁，此等待过程是带超时机制的，若等待超时则请求失败。
- 内存管理机制：每个实例各自本地的GLS内存池大小是固定的，受LOCK_POOL_SIZE配置参数控制。目前GLS内存通过hash bucket、freeList双链管理，hash bucket负责hash查找GLS Lock内存，freeList负责内存回收复用。


**性能**

当获取了对应的锁后，为了性能起见，会将获取的锁状态缓存在本地，当节点需要再次获取该锁时，无需请求锁资源的master节点，只有当其他实例获取状态互斥的锁时，才会释放本地的锁状态，属于被动释放，不会主动释放。

**DFX能力**

目前提供了V$GLS_LOCK、GV$GLS_LOCK动态视图

- V$GLS_LOCK：查看当前实例所有已使用的GLS LOCK内存具体信息
- GV$GLS_LOCK：查看所有实例所有已使用的GLS LOCK内存具体信息


###   [1.4 数据字典](#14-数据字典)  

**描述本篇文档中特性的术语集**

|术语|描述|
|---|---|
|Global Resource Catalog（GRC）|全局资源目录，管理所有资源master的信息|
|master|LockId通过一定计算得出管理该LockId的GRC所在的实例|
|requester|请求GLS Lock的实例|
|owner|当前持有GLS Lock的实例|
|权限X|写权限|
|权限S|读权限|
|global status|记录当前实例在master上登记的锁权限|
|local status|记录当前实例本地使用的锁权限情况|


##   [2. 接口](#2-接口)  

动态视图：V$GLS_LOCK、GV$GLS_LOCK

##   [3. 规格与约束](#3-规格与约束)  

**共享集群下，每个实例各自的GLS Lock总量受配置参数LOCK_POOL_SIZE控制**

##   [4. 特性](#4-特性)  

**GLS功能逻辑视图：**

![](https://pingcode.yasdb.com/atlas/files/public/67396939a1ad9a3311dc751c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNBQUFBQUFBQUFBQUFBQUFRQUFBQUFFQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQVFBQUVBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYwNDAsImV4cCI6MTc4MjEzNjg0MH0.YB6RLuBMAMO3Z5W7ds0q5vyUwBIjqtaEXIirdfYEiFI)

###   [4.1 GLS基本能力，请求X/S GLS Lock](#41-gls基本能力请求xs-gls-lock)  

GLS请求锁的核心是RMO（Requester - Master - Onwer）模型，总体可大致分为以下几步：

- requester向master发送消息请求锁
- master收到后对该请求进行调度。若当前正在处理其他实例的请求，则该请求需要排队，反正则直接处理。处理请求时需要判断请求的权限是否与owner状态相容，相容则直接授权，反之发送消息到owner unlock
- owner收到unlock消息释放本地锁状态，返回ack到master
- master等待所有owner回复汇总状态，直到所有owner锁状态与requester请求权限相容，授权requester
- requester收到master发来的授权消息，更新本地锁状态，返回闭环消息到master
- master收到闭环消息，处理下一个请求


![](https://pingcode.yasdb.com/atlas/files/public/673969398970c2af4f51f6a6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNBQUFBQUFBQUFBQUFBQUFRQUFBQUFFQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQVFBQUVBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYwNDAsImV4cCI6MTc4MjEzNjg0MH0.YB6RLuBMAMO3Z5W7ds0q5vyUwBIjqtaEXIirdfYEiFI)

###   [4.2 锁升级](#42-锁升级)  

锁升级主要应用于本地锁状态已经是S权限的前提下，向master申请X权限。master收到请求消息后，同样去校验是否与其他owner状态相容，根据相容与否进行进一步的处理，最终会获得X权限。

###   [4.3 锁降级](#43-锁降级)  

由于GLS Lock的锁状态在向master获取后，如果期间没有其他owner请求状态不相容的状态，则该锁状态会一直保持在本地。

在上述条件下，可能出现一种场景：实例A申请了X权限后，使用完释放了本地的status状态，但其在master的mode状态依旧是X，那么实例A后续的业务如果需要请求S权限，则在本地X权限的情况下，可以直接使用。即会出现，实例A在master上登记着X权限，在本地只使用了S权限。此时若实例B请求S权限，在master上发现实例A是X权限，状态不相容，发送消息到实例A unlock，此时发现实例A只使用了S权限，则此时无需等待，直接把实例A在master的mode状态降级成S权限，随后更新master的相关状态，授权实例B S权限即可。

从上述的流程可以看出，锁降级是被动降级，并不会主动降级。

###   [4.4 GLS内存回收](#44-gls内存回收)  

当某些GLS Lock不会再被使用时（如drop table，则该table对应的oid的GLS Lock不会再被使用，因为oid是递增的，不会复用），此时则需要回收该GLS Lock内存，以供后续使用。

目前GLS Lock的内存回收机制采用的是标记延迟回收，当确定某些GLS Lock不会再被使用时，标记删除，并将该GLS Lock添加进freeList中，在未来内存不足时，遍历freeList复用内存。

##   [5.未来规划](#5未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

[image2023-12-20_16-26-4.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5MzlhMWFkOWEzMzExZGM3NTBlIiwicmVmX2lkIjoiNjczOTY5Mzk3MjgyMDZlZmI5MmVmMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2MDQwLCJleHAiOjE3ODIyMTI0NDB9.6LOmacdWOxzkpioHYySj2atXMR0rqsjT1_0GDJnSq9g)

 (image/png)    


[image2023-12-20_16-26-58.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5MzlhMWFkOWEzMzExZGM3NTEwIiwicmVmX2lkIjoiNjczOTY5Mzk3MjgyMDZlZmI5MmVmMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2MDQwLCJleHAiOjE3ODIyMTI0NDB9.-xkVbHAJDIZUCY6jWZy5ze0rG9dPqN4_TN9awu6flNQ)

 (image/png)    


[image2023-12-20_16-28-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Mzk4OTcwYzJhZjRmNTFmNjk3IiwicmVmX2lkIjoiNjczOTY5Mzk3MjgyMDZlZmI5MmVmMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2MDQwLCJleHAiOjE3ODIyMTI0NDB9.nJcKI36jLH3zalPsmDoGaJ62tMI7gRxRUPPNwHBwnls)

 (image/png)    


[image2023-12-20_16-30-50.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5MzlhMWFkOWEzMzExZGM3NTEyIiwicmVmX2lkIjoiNjczOTY5Mzk3MjgyMDZlZmI5MmVmMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2MDQwLCJleHAiOjE3ODIyMTI0NDB9.zin7qVGN2Tl8SvwKsLhRU847nw1swm2yQ4rXHgEM6r8)

 (image/png)    


[image2023-12-20_16-49-37.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Mzk4OTcwYzJhZjRmNTFmNjliIiwicmVmX2lkIjoiNjczOTY5Mzk3MjgyMDZlZmI5MmVmMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2MDQwLCJleHAiOjE3ODIyMTI0NDB9.JIUOFy_PxYxKAlhY3Mx1znpJngLVUSxRY6Z8VRF_qd0)

 (image/png)    


[image2023-12-20_18-18-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Mzk4OTcwYzJhZjRmNTFmNjllIiwicmVmX2lkIjoiNjczOTY5Mzk3MjgyMDZlZmI5MmVmMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2MDQwLCJleHAiOjE3ODIyMTI0NDB9.sUgNP3GrRqdbMVy71K9n1uKpO0h_MEdO0hfQI43Hs4w)

 (image/png)    


[image2023-12-20_18-25-52.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Mzk4OTcwYzJhZjRmNTFmNjlmIiwicmVmX2lkIjoiNjczOTY5Mzk3MjgyMDZlZmI5MmVmMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2MDQwLCJleHAiOjE3ODIyMTI0NDB9.9jk6XboVgdL2VHmrFeVfFIlTa0Xr22KUEJZc0Emdazg)

 (image/png)    


[image2023-12-21_11-45-20.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5MzlhMWFkOWEzMzExZGM3NTE3IiwicmVmX2lkIjoiNjczOTY5Mzk3MjgyMDZlZmI5MmVmMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2MDQwLCJleHAiOjE3ODIyMTI0NDB9.aJqWUyQpRItSzhzxVIktjSD9egZND03rFZ_bNnNvBR8)

 (image/png)    


[image2023-12-21_11-46-54.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Mzk4OTcwYzJhZjRmNTFmNmExIiwicmVmX2lkIjoiNjczOTY5Mzk3MjgyMDZlZmI5MmVmMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2MDQwLCJleHAiOjE3ODIyMTI0NDB9.v2oskUQG8IaXbLAs-jgczub0ZO6-EuHSJxfNQs5sPhw)

 (image/png)    


[image2023-12-21_11-55-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Mzk4OTcwYzJhZjRmNTFmNmEzIiwicmVmX2lkIjoiNjczOTY5Mzk3MjgyMDZlZmI5MmVmMGQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2MDQwLCJleHAiOjE3ODIyMTI0NDB9.pGpX0fzo-5MaNd8fHNfpJsM61pmuMaCUbi_N09GtaWg)

 (image/png)    
