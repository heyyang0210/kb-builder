Created by 龙忠友, last modified by  李佐龙 on 十二月 20, 2023

## 1. Overview（概述）

      集群中某个实例crash之后，集群中在线的每个实例需要继续GRC的重分布与恢复。

## 2. Features（功能特性）

  


## 3. Interfaces（接口）

  


## 4. Limitations（功能限制）

  


## 5. Detail Design（详细设计）

### **5.1 总体流程**

  


![](https://pingcode.yasdb.com/atlas/files/public/67396b4a8970c2af4f520364/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUVJQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQ0FBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFFQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQVFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQVFBQUFBQUFBQUFJQUFBQUFBQUFBZ0FBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTI2NjYsImV4cCI6MTc4MjMwMzQ2Nn0.fFDYblHUFGy-Y6SRmGQ1Hk3jZJ4Oz_6BDoEmv1lybg8)

GRC资源重分布与迁移：

    1. master实例广播消息MSG_SEND_DHTRULE，这时候是根据当前topo上的instMap去发送，不给自己发，收到消息的实例替换当前的grc.rule

    2. master实例广播消息MSG_SEND_REFORM_INFO，这时候是根据当前topo上的instMal去发送，会给自己发，发送的消息有instCnt和当前reform的states。实例收到该消息后会进行资源迁移

    3. 收到上面广播消息的实例

             a，reform.dhtrule=grc.dhtrule    
               b，根据states和instCnt计算新的dhtrule    
               c，计算migrPart    
               d，migrate blockArea    
               e，migrate nonBlockArea

  


![](https://pingcode.yasdb.com/atlas/files/public/67396b4aa1ad9a3311dc81da/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUVJQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQ0FBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFFQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQVFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQVFBQUFBQUFBQUFJQUFBQUFBQUFBZ0FBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTI2NjYsImV4cCI6MTc4MjMwMzQ2Nn0.fFDYblHUFGy-Y6SRmGQ1Hk3jZJ4Oz_6BDoEmv1lybg8)

![](https://pingcode.yasdb.com/atlas/files/public/67396b4a8970c2af4f520365/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUVJQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQ0FBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFFQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQVFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQVFBQUFBQUFBQUFJQUFBQUFBQUFBZ0FBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTI2NjYsImV4cCI6MTc4MjMwMzQ2Nn0.fFDYblHUFGy-Y6SRmGQ1Hk3jZJ4Oz_6BDoEmv1lybg8)

  


GRC资源恢复

  1. master实例发起广播消息MSG_BEGIN_GRC_RECOVER

  2. 接收到上面消息的实例，分别起两个线程，GLS-RECOVER、GCS-RECOVER

  3. 每个线程分别扫描自己管理的master资源，然后抹掉此时不在集群的实例信息（非master节点crash）

  4. gls资源恢复线程扫描gls缓存区域，如果持有全局资源信息，则通知对应的master实例构建该master资源（master节点crash）

  5. gcs资源恢复线程扫描bufferPool，如果持有全局资源信息，则通知对应的master实例构建该master资源（master节点crash）

  6. master广播消息MSG_WAIT_GRC_RECOVER_END，查看资源恢复是否结束。

## 6. Testcases（用例）

## 7. Workload（工作量）

1. 评估代码量KLOC = xxx行
1. 评估工作量 =xxx（人天）


## 8. TODO（遗留问题）

待讨论的问题：

  1. GRC资源恢复构建master资源信息时，如果某个实例在ownermap里面，就说明这个实例持有全局的资源信息。那么在消息没有闭环时发生异常，也就是master资源的状态和实例owne的状态不一致时，GRC资源恢复构建master资源的行为需要重新定义。

     如：三个实例：inst0(S、PC)、inst1(S、PC)、inst2(S)

          现在inst2请求X，会进行锁升级，inst2收到ACK后，inst0(N、PC)、inst1(N、PC),  master资源的状态是ownermap(111)，没有发生闭环消息时，inst2 发生故障。



  


## Attachments:

[image2023-7-13_20-9-49.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNDk4OTcwYzJhZjRmNTIwMzYwIiwicmVmX2lkIjoiNjczOTZiNDk1OTNmOTljOWZmMjM2MDZlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyNjY2LCJleHAiOjE3ODIzNzkwNjZ9.MYZtWV8hg_1JB795_NFjWihECY0DRZQC4bNmcPat2gU)

 (image/png)    


[image2023-7-13_20-9-22.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNDk4OTcwYzJhZjRmNTIwMzYxIiwicmVmX2lkIjoiNjczOTZiNDk1OTNmOTljOWZmMjM2MDZlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyNjY2LCJleHAiOjE3ODIzNzkwNjZ9.n8DXlHpojoB0aW43og7fRYCD-UlSgi0J-pncCu3jVrU)

 (image/png)    


[remaster.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNDk4OTcwYzJhZjRmNTIwMzYyIiwicmVmX2lkIjoiNjczOTZiNDk1OTNmOTljOWZmMjM2MDZlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyNjY2LCJleHAiOjE3ODIzNzkwNjZ9.2cmU5j7bY7vrgtOBP8LstWKArOtE5tRxAr8pOWKlKgQ)

 (image/png)    


## Comments:

|  [](null)  ,1，资源在线访问,2，故障消息丢失,3，故障发生场景,4，并行扫描,Posted by zhangrui at 七月 17, 2023 17:37|
|---|
