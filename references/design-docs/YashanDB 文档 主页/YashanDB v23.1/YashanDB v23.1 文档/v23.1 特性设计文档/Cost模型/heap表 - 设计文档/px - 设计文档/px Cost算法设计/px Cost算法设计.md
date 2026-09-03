Created by 郭泽霖, last modified on 六月 30, 2023

# **适用场景：IR/SR特性的详细设计文档**

**注：成熟模块的特性**  建议概要设计和详细设计可合一，所以特性设计文档中描述的要素需全面。

**       关键特性**  需要有IR层级的概要设计和SR层级的详细设计，此文档主要关心SR层级的详细设计，IR概要设计文档已承载的功能拆分和架构说明可不赘述，通过链接说明。

*---------------以下为正文开始分隔线-----------------*

#   [YDBRD-XXXX : XXX Design（XXX方案设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#ydbrd-xxxx--xxx-designxxx%E6%96%B9%E6%A1%88%E8%AE%BE%E8%AE%A1)  

IR链接：YDBRD-XXXX / SR链接：YDBRD-XXXX

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#1-overview%E6%A6%82%E8%BF%B0)  

本设计文档用来初步描述所有数据交换算子的cost算法

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

### **2.1 px总览**

px cost大致分为三部分，下方端口序列化，数据分区及发送，上方端口接收，反序列化及数据合并，以及网络通信。

![](https://pingcode.yasdb.com/atlas/files/public/67396a2ba1ad9a3311dc7b4d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiR0FBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFCQUFBQUFBQUFBQUFBQUNBQUFBQUJBQUFBQUFBQUFBQUFRQUFBQUNBSUFBQUVBQUFBQUFBQUtBQUFGQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUlBQUFBQUFBQUFBUUF3QUNBQUFnQUNBQUFBQUFBQUFBSUFBQUFBQUFDQUFBQUlBQUFBQUVRQUFFQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE0NTcsImV4cCI6MTc4MjIyMjI1N30.X9t4wOQ4t2Jxaa_fQwhur0X1T1WG-66etUUvNcYhkIE)

### **2.2 px recv**

recv目前实现了两种，一种是直接fetch的，下称random merge，另一种是拿所有端口收到的最值向上层返回，下称sort merge。

random merge原理很简单，每次去一个read list处取一个block 来fetch，这个read list可以认为就是recv算子的缓冲区。

DetachR指的是每个block读完之后给writer发一个ACK；AttachR指的是从缓冲区获取一个block，反序列化用的是matDecode。

这里考虑网络通信的方法是通过参数，1.writeAck表示ack发送时间，2.waitR表示平均响应时间。

对于blockcount，根据writer的个数算法有所不同。outRows的选择亦然。

![](https://pingcode.yasdb.com/atlas/files/public/67396a2b8970c2af4f51fcd7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiR0FBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFCQUFBQUFBQUFBQUFBQUNBQUFBQUJBQUFBQUFBQUFBQUFRQUFBQUNBSUFBQUVBQUFBQUFBQUtBQUFGQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUlBQUFBQUFBQUFBUUF3QUNBQUFnQUNBQUFBQUFBQUFBSUFBQUFBQUFDQUFBQUlBQUFBQUVRQUFFQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE0NTcsImV4cCI6MTc4MjIyMjI1N30.X9t4wOQ4t2Jxaa_fQwhur0X1T1WG-66etUUvNcYhkIE)

sort merge 就是建一个大小为发送端口数的堆，每次出一条最值然后再递补插入一条来自同一个端口的数据。端口数目前最大是255，可以认为不会超出内存限制。

sortRecv主要的操作其实就是从下至上调整跟从上至下调整两种。其中，insert是插入到堆底，然后从下至上调整；delete是swap一个堆底的元素到堆顶，然后从上至下调整。这里简单认为从上至下的开销是从下至上的两倍。

![](https://pingcode.yasdb.com/atlas/files/public/67396a2ba1ad9a3311dc7b4e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiR0FBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFCQUFBQUFBQUFBQUFBQUNBQUFBQUJBQUFBQUFBQUFBQUFRQUFBQUNBSUFBQUVBQUFBQUFBQUtBQUFGQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUlBQUFBQUFBQUFBUUF3QUNBQUFnQUNBQUFBQUFBQUFBSUFBQUFBQUFDQUFBQUlBQUFBQUVRQUFFQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE0NTcsImV4cCI6MTc4MjIyMjI1N30.X9t4wOQ4t2Jxaa_fQwhur0X1T1WG-66etUUvNcYhkIE)

### **2.3 px send**

send基本上跟recv是对应的，不过detach跟attach都需要每行计算一次，并且多一个sendEof的开销。

![](https://pingcode.yasdb.com/atlas/files/public/67396a2b8970c2af4f51fcd8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiR0FBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFCQUFBQUFBQUFBQUFBQUNBQUFBQUJBQUFBQUFBQUFBQUFRQUFBQUNBSUFBQUVBQUFBQUFBQUtBQUFGQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUlBQUFBQUFBQUFBUUF3QUNBQUFnQUNBQUFBQUFBQUFBSUFBQUFBQUFDQUFBQUlBQUFBQUVRQUFFQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE0NTcsImV4cCI6MTc4MjIyMjI1N30.X9t4wOQ4t2Jxaa_fQwhur0X1T1WG-66etUUvNcYhkIE)

hash send比random send多一个计算hash key 对应端口的开销，broadcast相比random，在detach跟attach上乘端口倍数。

![](https://pingcode.yasdb.com/atlas/files/public/67396a2ba1ad9a3311dc7b4f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiR0FBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFCQUFBQUFBQUFBQUFBQUNBQUFBQUJBQUFBQUFBQUFBQUFRQUFBQUNBSUFBQUVBQUFBQUFBQUtBQUFGQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUlBQUFBQUFBQUFBUUF3QUNBQUFnQUNBQUFBQUFBQUFBSUFBQUFBQUFDQUFBQUlBQUFBQUVRQUFFQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE0NTcsImV4cCI6MTc4MjIyMjI1N30.X9t4wOQ4t2Jxaa_fQwhur0X1T1WG-66etUUvNcYhkIE)

### **2.4 dstb stats 修正**

假定分布表的分布规则是条数平均分配，而hash send之后的分布规则是ndv平均分配。

推算ndv用到的参数Fd，Fn表示在条数近似均匀的情况下，ndv的分布情况。

推算hash send之后，最大分区的条数所用的参数Fh，表示不同hash值对应同一个端口的情况。

![](https://pingcode.yasdb.com/atlas/files/public/67396a2b8970c2af4f51fcd9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiR0FBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFCQUFBQUFBQUFBQUFBQUNBQUFBQUJBQUFBQUFBQUFBQUFRQUFBQUNBSUFBQUVBQUFBQUFBQUtBQUFGQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUlBQUFBQUFBQUFBUUF3QUNBQUFnQUNBQUFBQUFBQUFBSUFBQUFBQUFDQUFBQUlBQUFBQUVRQUFFQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE0NTcsImV4cCI6MTc4MjIyMjI1N30.X9t4wOQ4t2Jxaa_fQwhur0X1T1WG-66etUUvNcYhkIE)

##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#3-interfaces%E6%8E%A5%E5%8F%A3)  

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#51-architecture%E6%9E%B6%E6%9E%84)  

###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

###   [5.3 Compatibility（兼容性）](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#53-compatibility%E5%85%BC%E5%AE%B9%E6%80%A7)  

###   [5.4 DFX设计](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#54-dfx%E8%AE%BE%E8%AE%A1)  

###   [5.5 其他](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#55-%E5%85%B6%E4%BB%96)  

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

## Attachments:

[image2023-6-15_19-8-16.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMmE4OTcwYzJhZjRmNTFmY2QyIiwicmVmX2lkIjoiNjczOTZhMmE3MjgyMDZlZmI5MmVmYjQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDU3LCJleHAiOjE3ODIyOTc4NTd9.X7hZzojKMlBu3eE8IUBXRdg3TlICD2iWWMcV3sS-Y_I)

 (image/png)    


[image2023-6-15_19-15-17.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMmFhMWFkOWEzMzExZGM3YjQ4IiwicmVmX2lkIjoiNjczOTZhMmE3MjgyMDZlZmI5MmVmYjQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDU3LCJleHAiOjE3ODIyOTc4NTd9.hvknc5rz1_pikH-Iv8u9WIS0kijJ6O9_Z5GO9CL9yok)

 (image/png)    


[image2023-6-15_19-18-49.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMmE4OTcwYzJhZjRmNTFmY2QzIiwicmVmX2lkIjoiNjczOTZhMmE3MjgyMDZlZmI5MmVmYjQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDU3LCJleHAiOjE3ODIyOTc4NTd9.YGiJFVkBP_tGnk7GW20Cp2o2jnO2RJXatz4cHcfCTC4)

 (image/png)    


[image2023-6-30_18-1-59.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMmFhMWFkOWEzMzExZGM3YjQ5IiwicmVmX2lkIjoiNjczOTZhMmE3MjgyMDZlZmI5MmVmYjQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDU3LCJleHAiOjE3ODIyOTc4NTd9.LmuxdOjXVuGUDuipHMxNe81x_MwG8LnSOJHzI5ZxttM)

 (image/png)    


[image2023-6-30_18-9-22.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMmFhMWFkOWEzMzExZGM3YjRhIiwicmVmX2lkIjoiNjczOTZhMmE3MjgyMDZlZmI5MmVmYjQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDU3LCJleHAiOjE3ODIyOTc4NTd9.t-mxD9xAI7x_O9BIpseco1cOimdtkXV6dMcp0oOI75M)

 (image/png)    
