Created by 高风朴, last modified on 八月 07, 2023

## 1. Overview（概述）

我们需要打磨一套稳定可靠的yfs系统，以应对各种故障场景，提供高可用的服务

## 2. Features（功能特性）

支持yfs可以处理普通故障，提高集群高可用

## 3. Interfaces（接口）

不涉及接口修改

## 4. Limitations（功能限制）

本次集群节点数只考虑两节点场景。

## 5. Detail Design（详细设计）

故障场景分析：

|场景|模块|故障原因|当前处理方式|建议处理方式|备注|
|---|---|---|---|---|---|
|在线故障，备机业务不会报错|备机转发请求|转发请求时主故障|直接报错，返回客户端|网络错误，重试|  
|
|||转发请求时，主正在做备升主|报错，要求客户端重试|重试|  
|
||read/write|yfs挂掉，共享内存没清|  
|暂不处理|  
|
|网络超时相关场景优化，不会出现hang死情况|备机转发请求|主由于网络问题消息没有返回|死等|ycs报错，yfs重试|  
|
||复制|备机故障|根据topo变化，将故障机器踢出集群|  
|  
|
|||备机回放后，网络问题，没有收到回包|主机死等|ycs,报错，yfs重试|  
|
||备机启动加入集群|备机启动阶段，主故障|重试|  
|  
|
|||备机启动阶段，主在做备升主|重试|  
|  
|
|||备机启动时，主机正在做业务（业务比较耗时）|继续等待加入|  
|  
|
|||备机加入后，主机一直等不到end build消息|根据topo变化，将故障机器踢出集群|  
|  
|
||备升主|主机等待备机加入阶段，备机挂掉|根据topo变化，将故障机器踢出集群|  
|  
|
|||备升主过程，出现错误|  
|调用yfsRaiseFatalErr|  
|
|优化yfsRaiseFatalErr，包括通知ycs热重启yfs，记录日志等|  
|  
|当前为直接COD_PANIC|修改为：,1.打印日志，    
  2.如果是集群模式，调用ycs restart接口重启，否则，直接panic|  
|


**以下是yfs涉及故障的相关模块处理逻辑**

## 5.1 备机启动

![](https://pingcode.yasdb.com/atlas/files/public/67396af3a1ad9a3311dc7e99/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFBQUlBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBRUFBSUFBQkFBQUFBQUFBQUFFQUFBQUFnQUFBQUFBSUFBQUFBQUFBQVFXZ0JBQUFBQVFBQUVBQUFBQkFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAyNjMsImV4cCI6MTc4MjMwMTA2M30.00MkFjhDvI-R7G837tGTbwuSwnUW5QZe72mCsAPcvBY)

## 5.2 备机stop

![](https://pingcode.yasdb.com/atlas/files/public/67396af38970c2af4f520023/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFBQUlBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBRUFBSUFBQkFBQUFBQUFBQUFFQUFBQUFnQUFBQUFBSUFBQUFBQUFBQVFXZ0JBQUFBQVFBQUVBQUFBQkFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAyNjMsImV4cCI6MTc4MjMwMTA2M30.00MkFjhDvI-R7G837tGTbwuSwnUW5QZe72mCsAPcvBY)

## 5.3 备机升主

![](https://pingcode.yasdb.com/atlas/files/public/67396af38970c2af4f520024/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFBQUlBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBRUFBSUFBQkFBQUFBQUFBQUFFQUFBQUFnQUFBQUFBSUFBQUFBQUFBQVFXZ0JBQUFBQVFBQUVBQUFBQkFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAyNjMsImV4cCI6MTc4MjMwMTA2M30.00MkFjhDvI-R7G837tGTbwuSwnUW5QZe72mCsAPcvBY)

## 5.4 主备复制

![](https://pingcode.yasdb.com/atlas/files/public/67396af3a1ad9a3311dc7e9a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFBQUlBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBRUFBSUFBQkFBQUFBQUFBQUFFQUFBQUFnQUFBQUFBSUFBQUFBQUFBQVFXZ0JBQUFBQVFBQUVBQUFBQkFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAyNjMsImV4cCI6MTc4MjMwMTA2M30.00MkFjhDvI-R7G837tGTbwuSwnUW5QZe72mCsAPcvBY)

## 5.5 请求转发

![](https://pingcode.yasdb.com/atlas/files/public/67396af38970c2af4f520025/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFBQUlBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBRUFBSUFBQkFBQUFBQUFBQUFFQUFBQUFnQUFBQUFBSUFBQUFBQUFBQVFXZ0JBQUFBQVFBQUVBQUFBQkFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAyNjMsImV4cCI6MTc4MjMwMTA2M30.00MkFjhDvI-R7G837tGTbwuSwnUW5QZe72mCsAPcvBY)

## 6. Testcases（用例）

  


|  
|测试用例|前置条件|预期|测试是否通过|
|---|---|---|---|---|
|备机启动|yfs备机启动，此时主机故障（启动的备机不是主）|启动前，集群中多个节点|备升主成功后，备机正常加入|不测|
||yfs备机启动，此时主机故障（启动的备机变为主）|启动前，集群中1个节点|备机正常启动|  
|
|备升主|yfs备升主过程中，有备机离线|  
|正常备升主|  
|
||yfs备升主过程中，有节点随机加入|  
|备升主正常，新节点正常加入|不测|
|转发|yfs转发备机请求到主机，主机挂掉|  
|备升主后，请求被正常处理|  
|
||yfs转发备机请求到主机，主机闪断|  
|备机重发消息，主机正常处理|  
|
|主备复制|yfs主备复制过程中，备机离线|  
|yfs正常|  
|


门槛用例

|故障分类|故障场景|预期|测试结果|
|---|---|---|---|
|磁盘异常|集群部署成功后，修改磁盘权限构造磁盘异常|正常报错，无core|  
|
|  
|集群部署成功后，修改磁盘路径构造磁盘异常|正常报错，无core|  
|
|网络异常|集群部署成功后，主节点上构造网络延迟|备节点能检测到心跳超时，网络正常后，主备服务正常|  
|
|  
|集群部署成功后，备节点上构造网络丢包|主节点能检测到心跳超时，网络正常后，主备服务正常|  
|
|服务器异常|reboot，服务器重启后检查YFS数据一致性|集群实例正常，YFS数据保持一致|  
|
|资源异常|写满内存后，启动集群|正常报错，无core或hang住|  
|
|  
|YCS/YFS有共享内存残留，启动集群|启动集群成功，不受影响|  
|
|进程异常退出|集群部署成功后，kill -19 主/备节点，kill -18 启动|表现正常，无core|  
|
|  
|集群部署成功后，kill -9 主/备节点|表现正常，无core|  
|
|  
|集群部署成功后，kill -9 主/备节点，再拉起节点|表现正常，无core，再次拉起节点成功|  
|
|  
|集群部署成功后，以不同方式并发kill两节点(kill -19,kill -9)|表现正常，无core|  
|
|基础业务|主节点只启动YCS，备节点启动YCS+DB，集群正常运行后，kill YCS主节点，备节点下发数据库相关业务|无core，下发业务正常|  
|
|  
|主节点启动YCS+DB，备节点只启动YCS，集群正常运行后，kill YCS备节点，主节点下发数据库相关业务|无core，下发业务正常|  
|
|  
|主节点只启动YCS，备节点启动YCS+DB，集群正常运行后，kill YCS主节点，备节点下发数据库相关业务，拉起原主节点YCS+DB，继续下发业务|无core，下发业务正常|  
|
|  
|主节点只启动YCS，备节点启动YCS+DB，集群正常运行后，kill YCS主节点，备节点下发数据库相关业务，拉起原主节点YCS+DB，继续下发业务，再kill原YCS备节点，继续在存活节点下发业务|无core，下发业务正常|  
|
|  
|主节点只启动YCS，备节点启动YCS+DB，kill YCS主节点的过程中，备节点下发数据库相关业务|无core，下发业务正常|  
|
|  
|备节点只启动YCS，主节点启动YCS+DB，kill YCS备节点的过程中，主节点下发数据库相关业务|无core，下发业务正常|  
|
|  
|主备节点只启动YCS，集群正常运行后，kill YCS主节点，备节点下发YFS相关业务|无core，下发业务正常|  
|
|  
|主备节点只启动YCS，集群正常运行后，kill YCS备节点，主节点下发YFS相关业务|无core，下发业务正常|  
|
|  
|主备节点只启动YCS，集群正常运行后，kill YCS主节点，备节点下发YFS相关业务，拉起原主节点YCS，继续下发业务|无core，下发业务正常|  
|
|  
|主备节点只启动YCS，集群正常运行后，kill YCS主节点，备节点下发YFS相关业务，拉起原主节点YCS，继续下发业务，再次kill原YCS备节点，继续在存活节点下发业务|无core，下发业务正常|  
|
|  
|主备节点只启动YCS，kill YCS主节点的过程中，备节点下发YFS相关业务|无core，下发业务正常|  
|
|  
|主备节点只启动YCS，kill YCS备节点的过程中，主节点下发YFS相关业务|无core，下发业务正常|  
|
|  
|主机节点上只启动YCS，在主节点上做了一些业务，备节点加入集群后，kill掉主节点过程中，备节点下发YFS相关业务|无core，下发业务正常|  
|
|  
|主机节点上只启动YCS，在主节点上做了一些业务，备节点加入集群后，kill掉备节点过程中，主节点下发YFS相关业务|无core，下发业务正常|  
|


## 7. Workload（工作量）

## 8. TODO（遗留问题）

## Attachments: