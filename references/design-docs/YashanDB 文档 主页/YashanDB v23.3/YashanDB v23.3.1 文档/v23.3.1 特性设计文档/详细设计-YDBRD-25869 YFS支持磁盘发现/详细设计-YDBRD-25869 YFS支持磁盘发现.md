Created by 高风朴, last modified on 五月 27, 2024

*R链接：*    [https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b081](https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b081)    *?*    
  *#YASHAN-305 YCS支持多盘，支持YFS管理YCS数据*

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/6611a8b5579a3edb84d860e9](https://pingcode.yasdb.com/pjm/items/6611a8b5579a3edb84d860e9)    *?*    
  *#YDBRD-25869 YFS支持磁盘发现*

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-%E6%80%BB%E8%BF%B0)  

目前YFS是将磁盘信息保存在YCR磁盘的。后续YCR+VOTING disk都需要有YFS管理。因此YFS磁盘信息不能继续放在YCR。而应该自己记录管理。

另外，ASM，DMASM 都支持磁盘发现。我们也需要对标竞品。

磁盘发现的特点是，不同节点间，同一磁盘的名称可以不一样（多数场景会配置一样，方便运维）

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

fs自己的磁盘信息本身就应该自己管理。

另外竞品已经做了该能力。我们也应该对标竞品

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

  [特性调研-YDBRD-25869 YFS支持磁盘发现 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150619653)  

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|磁盘发现|磁盘发现|通过diskheader信息构建diskgroup，failgroup|是|是|
|信息存储|disk/diskgroup信息存储|早期yfs的disk/failgroup/diskgroup信息存储在ycr，磁盘发现后需要自己管理|是|是|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|diskrecovery|通过diskheader上的信息，自底向上构建diskgorup信息|是|  [Oracle ASM Disk Discovery](https://docs.oracle.com/en/database/oracle/oracle-database/21/ostmg/asm-disk-discovery.html#GUID-CD6B3821-FF1A-4882-BF10-97CE138C800D)  |


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

不涉及

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-%E6%8E%A5%E5%8F%A3)  

|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|配置参数|YFS_DISKSTRING|----|是/否|


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

1. 各个节点间disk路径需要保持一致。
1. 各节点间只能保证每个diskgroup内，磁盘信息一致。无法保证节点间diskgroup数量丢失问题。如果某个节点，属于某个diskgroup的所有disk都丢失了。则无法加载该diskgorup；


##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-%E7%89%B9%E6%80%A7)  

###   [4.1 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)    YFS_DISKSTRING参数

我们需要一个增加一个参数，来指定YFS 磁盘搜索路径。这个参数就是YFS_DISKSTRING。

|特性|描述|
|---|---|
|类型|String|
|语法|YFS_DISKSTRING = discovery_string [, discovery_string ] ...|
|默认值|/dev/,   yfs会自动搜索/dev/下所有当前用户具备读写能力的磁盘|
|在线修改|ALTER system set YFS_DISKSTRING='discovery_string [, discovery_string ] ...'  ，路径更新只能新增，不可以已经存在的路径删除|
|长度限制|256|
|正则|最后一级目录支持"*"通配符。|


###   [4.2 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)    disk/diskgroup信息存放

以前YFS磁盘信息是放在YCR disk中的，改造为磁盘发现后，YFS需要自己管理磁盘，磁盘组信息。

#### 4.2.1 disk信息

我们新建一个文件，fd=4， 用于存储4号文件。YFS_DG_MAX_DISKS*sizeof（YfsDiskCtrl）=4,194,304字节=1024个block=4M。格式同以前版本无差别。

#### 4.2.2 diskgroup信息

diskgroup状态信息存储在diskheader上即可。

注：并不是每个disk都更新。只在bootau有效的disk更新即可。更新时，按顺序更新。读取时也按照相应的顺序读取。

###   [4.3 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)    diskgroup相关流程梳理

#### 4.3.1 创建diskgroup

![](https://pingcode.yasdb.com/atlas/files/public/67396edc8970c2af4f521bf2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFFQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQWdBQUFBQUFJQUFBQUFBQUlBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBSUFBQUFBQWdBQUFBQUFBQUFJQUFBQUFBQUFBQWdBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ0OTUsImV4cCI6MTc4MjQ1NTI5NX0.dgYEBvdANZM4iaMDbJKa1acAW7TpFFHL-vJ8dQShhDc)

与当前流程无差异，只是将dg，disk磁盘信息存储位置做了调整。（不持久化fg信息）

异常处理：

创建dg未结束，进程被kaill掉。那么系统在构建diskgroup的时候，dg 状态没有online。那么需要擦除该dg内disk的diskheader信息。

#### 4.3.2 drop diskgroup

![](https://pingcode.yasdb.com/atlas/files/public/67396edca1ad9a3311dc9a65/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFFQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQWdBQUFBQUFJQUFBQUFBQUlBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBSUFBQUFBQWdBQUFBQUFBQUFJQUFBQUFBQUFBQWdBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ0OTUsImV4cCI6MTc4MjQ1NTI5NX0.dgYEBvdANZM4iaMDbJKa1acAW7TpFFHL-vJ8dQShhDc)

流程与当前drop diskgroup差异在与offlinediskgroup之后：    
  当前流程是：持久化各个disk在ycr的信息unused。

修改后：需要将dg内各个disk的diskheader信息擦除。

  


流程未执行完毕处理：    
  如果dg 状态已经被设置为offline。那么同创建dg异常处理一样即可。

#### 4.3.3 alter diskgroup add disk

1. 校验adddisks
1. createdisk（如有必要，同时创建fg）
1. 更新pst
1. 在4号文件（diskDir）上添加disk信息。
1. 写redo
1. 共享内存重新加载disk。


同以前流程相比，增加了步骤4.

  


流程未执行完毕处理：    
  如果diskheader已经格式化。那么重启构建diskgroup后，mountdiskgroup后。通过对比diskDir上信息，可以找到那些磁盘是新增的。需要将这些新增disk的diskheader信息抹掉。并更新dg内原disk的pst信息。 

#### 4.3.4 alter diskgroup drop disk(当前版本未实现)

1. 校验dropdisk
1. 删除disk对应在diskdir上的信息
1. 更新pst
1. 擦除disk的diskheader
1. 写redo
1. 更新disk的共享内存信息


#### 4.3.5 启动构建diskgorup

启动构建diskgroup包含两步：

1.通过磁盘发现构建diskgroup

2. mountdiskgroup

##### 4.3.5.1 通过磁盘发现构建diskgroup信息，需要对原yfsLoadDiskgroups函数改造。

![](https://pingcode.yasdb.com/atlas/files/public/67396edc8970c2af4f521bf3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFFQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQWdBQUFBQUFJQUFBQUFBQUlBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBSUFBQUFBQWdBQUFBQUFBQUFJQUFBQUFBQUFBQWdBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ0OTUsImV4cCI6MTc4MjQ1NTI5NX0.dgYEBvdANZM4iaMDbJKa1acAW7TpFFHL-vJ8dQShhDc)

如果构建diskgroup后。发现diskgroup状态为offline。需要将该dg内所有disk的diskheader抹掉。（同createdg，dropdg异常流程）

##### 4.3.5.2 mountdiskgroup（doMountDiskgroup函数）

1. 启动过程，doMountDiskgroup后
1. 校验dg内磁盘与diskdir中磁盘是否一致，如果不一致，参考adddisk流程异常处理。


###   [4.8 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#47-%E7%89%B9%E6%80%A7%E5%91%A8%E8%BE%B9%E9%85%8D%E5%90%88)    兼容性问题

本次不与23.2版本兼容，兼容性本次时间太紧，暂不实现升级工具。

升级逻辑如下：

1. 启动yfssrv
1. 在yfssrv创建4号文件，将dg内disk信息写入改文件。
1. 更新diskheader信息，将4号文件入口记录到diskheader。


##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 功能上，保证涉及dg的各流程正常运行
1. 异常场景：对各流程中间设置断点。异常处理流程符合预期
1. 参数正常起作用。
1. 对多节点间，磁盘名字不一样，验证运行ok


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

更新参数

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

将ycr和votingdisk放在yfs管理

## Attachments:

[image2024-4-23_19-54-40.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZGJhMWFkOWEzMzExZGM5YTUyIiwicmVmX2lkIjoiNjczOTZlZGI1OTNmOTljOWZmMjM4YTMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NDk1LCJleHAiOjE3ODI1MzA4OTV9.fRXxjfNpWH8A9-hcb21to8GVwIaHVA1h1irM1UdH6WE)

 (image/png)    


[image2024-4-23_15-38-26.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZGJhMWFkOWEzMzExZGM5YTUzIiwicmVmX2lkIjoiNjczOTZlZGI1OTNmOTljOWZmMjM4YTMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NDk1LCJleHAiOjE3ODI1MzA4OTV9.-3B3za-m9x_mVjNOZ_jtoBHLO-eKKzfqLHypi01EctA)

 (image/png)    


[image2024-4-23_10-10-50.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZGI4OTcwYzJhZjRmNTIxYmUxIiwicmVmX2lkIjoiNjczOTZlZGI1OTNmOTljOWZmMjM4YTMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NDk1LCJleHAiOjE3ODI1MzA4OTV9.coXkdgz-nZpO0N-4b_K5ziM7ERW6q7JmiKgKK_Tb-nM)

 (image/png)    


[image2024-4-23_9-57-27.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZGI4OTcwYzJhZjRmNTIxYmUyIiwicmVmX2lkIjoiNjczOTZlZGI1OTNmOTljOWZmMjM4YTMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NDk1LCJleHAiOjE3ODI1MzA4OTV9._T2SX0hFGf-5V-7VsDwztLHvM1Yfh90l6F4DN3wJcOs)

 (image/png)    


[image2024-4-23_9-38-28.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZGJhMWFkOWEzMzExZGM5YTU1IiwicmVmX2lkIjoiNjczOTZlZGI1OTNmOTljOWZmMjM4YTMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NDk1LCJleHAiOjE3ODI1MzA4OTV9.2Qgbwh-WfnZ4P1GTZ18vVCcpK7NTgTfe4ohMT1qRDgQ)

 (image/png)    


[image2024-4-23_9-35-35.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZGI4OTcwYzJhZjRmNTIxYmUzIiwicmVmX2lkIjoiNjczOTZlZGI1OTNmOTljOWZmMjM4YTMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NDk1LCJleHAiOjE3ODI1MzA4OTV9._Gd__qYmPoNqxcmBf9xHHgdmYxy5-TSda_u6GOhfan0)

 (image/png)    


[image2024-4-23_9-35-19.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZGI4OTcwYzJhZjRmNTIxYmU0IiwicmVmX2lkIjoiNjczOTZlZGI1OTNmOTljOWZmMjM4YTMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NDk1LCJleHAiOjE3ODI1MzA4OTV9.fcW8xhSmno14bCki4M5S507EvQTGLn_id8UwP5u_O78)

 (image/png)    


[image2024-4-23_9-34-49.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZGI4OTcwYzJhZjRmNTIxYmU1IiwicmVmX2lkIjoiNjczOTZlZGI1OTNmOTljOWZmMjM4YTMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NDk1LCJleHAiOjE3ODI1MzA4OTV9.EJqwXaY6t02DytYThj9WC-SoYytF4fEwjaOEdfR5-qA)

 (image/png)    


[image2024-4-23_9-34-24.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZGI4OTcwYzJhZjRmNTIxYmU2IiwicmVmX2lkIjoiNjczOTZlZGI1OTNmOTljOWZmMjM4YTMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NDk1LCJleHAiOjE3ODI1MzA4OTV9.1qz9PBtzNGWDxl9R_ZZg0_iJ_7qJ_A-et1sQAwzrINA)

 (image/png)    


[image2024-4-23_9-34-3.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZGJhMWFkOWEzMzExZGM5YTU3IiwicmVmX2lkIjoiNjczOTZlZGI1OTNmOTljOWZmMjM4YTMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NDk1LCJleHAiOjE3ODI1MzA4OTV9.f7rh_Eo47X0OMbUnyb5CwaI8RJOxdfIsJ48hy8hwkvg)

 (image/png)    


[image2024-4-23_9-33-40.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZGJhMWFkOWEzMzExZGM5YTU4IiwicmVmX2lkIjoiNjczOTZlZGI1OTNmOTljOWZmMjM4YTMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NDk1LCJleHAiOjE3ODI1MzA4OTV9.6oHHMy9vqusQwiv_vZxpVVoRPuNht-mgDsZ6wxHyD9E)

 (image/png)    


[image2024-4-23_9-25-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZGJhMWFkOWEzMzExZGM5YTU5IiwicmVmX2lkIjoiNjczOTZlZGI1OTNmOTljOWZmMjM4YTMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NDk1LCJleHAiOjE3ODI1MzA4OTV9.rwJybI7KslfDMo8CHYQBqxOQEhBcEFxTcQ4B3b4aUmM)

 (image/png)    


[image2024-4-22_20-6-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZGI4OTcwYzJhZjRmNTIxYmU3IiwicmVmX2lkIjoiNjczOTZlZGI1OTNmOTljOWZmMjM4YTMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NDk1LCJleHAiOjE3ODI1MzA4OTV9.fStFbszyo-4wC8XFMPUYz8rCmkY9nzoiOKQSwYAxmbg)

 (image/png)    


[image2024-4-22_19-13-21.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZGI4OTcwYzJhZjRmNTIxYmU4IiwicmVmX2lkIjoiNjczOTZlZGI1OTNmOTljOWZmMjM4YTMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NDk1LCJleHAiOjE3ODI1MzA4OTV9.mkfzXYyRnSgsf1ikSuC4o5andJD5xoPf9spsnIxl0HM)

 (image/png)    


[image2024-4-22_19-13-6.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZGJhMWFkOWEzMzExZGM5YTViIiwicmVmX2lkIjoiNjczOTZlZGI1OTNmOTljOWZmMjM4YTMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NDk1LCJleHAiOjE3ODI1MzA4OTV9.-jMrmFAeiyb9F8aQ0xqiL1YMzaC8tHm2x98wpQda1Lo)

 (image/png)    


[image2024-4-22_19-12-32.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZGJhMWFkOWEzMzExZGM5YTVjIiwicmVmX2lkIjoiNjczOTZlZGI1OTNmOTljOWZmMjM4YTMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NDk1LCJleHAiOjE3ODI1MzA4OTV9.u59DScut2KHafar8_0RiAyayH5Kq-E4PJsYwQlo-YzI)

 (image/png)    


[image2024-4-22_19-10-3.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZGI4OTcwYzJhZjRmNTIxYmVhIiwicmVmX2lkIjoiNjczOTZlZGI1OTNmOTljOWZmMjM4YTMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NDk1LCJleHAiOjE3ODI1MzA4OTV9.CKr2-cUkiY8af-oUNZ6Obq-5ujJtG9v1djanUhSbr6I)

 (image/png)    


[image2024-4-22_17-39-27.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZGNhMWFkOWEzMzExZGM5YTVkIiwicmVmX2lkIjoiNjczOTZlZGI1OTNmOTljOWZmMjM4YTMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NDk1LCJleHAiOjE3ODI1MzA4OTV9.qxiWN17npan9dt-TLbeqzCNcRqVPr9I270KQfDetLN4)

 (image/png)    


[image2024-4-22_17-30-19.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZGM4OTcwYzJhZjRmNTIxYmViIiwicmVmX2lkIjoiNjczOTZlZGI1OTNmOTljOWZmMjM4YTMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NDk1LCJleHAiOjE3ODI1MzA4OTV9.OyBv_pIAWyCW4hGSFD625deJ_VVecD_LtWZ-unbumYA)

 (image/png)    


[image2024-4-22_17-11-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZGNhMWFkOWEzMzExZGM5YTVlIiwicmVmX2lkIjoiNjczOTZlZGI1OTNmOTljOWZmMjM4YTMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NDk1LCJleHAiOjE3ODI1MzA4OTV9.Fl56PUAn719qKPJYpVlug2FRrlC5cG1KWtGrQhmFrAI)

 (image/png)    


[image2024-4-22_17-8-44.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZGNhMWFkOWEzMzExZGM5YTVmIiwicmVmX2lkIjoiNjczOTZlZGI1OTNmOTljOWZmMjM4YTMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NDk1LCJleHAiOjE3ODI1MzA4OTV9.ubHLEQCHJMehPFZPJ6qDztT9dxGCbIBuVXGM8EwETos)

 (image/png)    


[image2024-4-22_17-7-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZGM4OTcwYzJhZjRmNTIxYmVkIiwicmVmX2lkIjoiNjczOTZlZGI1OTNmOTljOWZmMjM4YTMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NDk1LCJleHAiOjE3ODI1MzA4OTV9.7zhybqJ3ZTnjkT7as3ZMKjsBmsVjtmPz3bXAdM3XQsI)

 (image/png)    


[image2024-4-22_17-7-6.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZGNhMWFkOWEzMzExZGM5YTYwIiwicmVmX2lkIjoiNjczOTZlZGI1OTNmOTljOWZmMjM4YTMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NDk1LCJleHAiOjE3ODI1MzA4OTV9.7586DJJnY9LbB29DSEPUB4RZ5BTsKc5ufsWn3HpjZE8)

 (image/png)    


[image2024-4-22_14-59-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZGM4OTcwYzJhZjRmNTIxYmVlIiwicmVmX2lkIjoiNjczOTZlZGI1OTNmOTljOWZmMjM4YTMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NDk1LCJleHAiOjE3ODI1MzA4OTV9.suY9J7d85vuY69OpbNdRxBfTuOcFr87i8dZnFPXZHJQ)

 (image/png)    


[image2024-4-22_14-43-51.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZGNhMWFkOWEzMzExZGM5YTYyIiwicmVmX2lkIjoiNjczOTZlZGI1OTNmOTljOWZmMjM4YTMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NDk1LCJleHAiOjE3ODI1MzA4OTV9.exfSWYV7JmLY4YB31KtWzW71lg0hNtx2Ab9sMUQJGCQ)

 (image/png)    


[image2024-4-22_14-28-10.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZGM4OTcwYzJhZjRmNTIxYmVmIiwicmVmX2lkIjoiNjczOTZlZGI1OTNmOTljOWZmMjM4YTMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NDk1LCJleHAiOjE3ODI1MzA4OTV9.FmGYjGf08lfCF7nQ3LzNFdwDW9sWH0bnhv8Gi2Mf8lA)

 (image/png)    


## Comments:

|  [](null)  ,时间：2024.4.26 9:30~10:30,地点：腾讯会议,与会人：郭藏龙，马勇，高风朴。,议题：yfs支持磁盘发现详细设计评审,结论：    
  1. diskgroup信息存储在diskheader上。并不是每个disk的diskheader都存储，如果dg内diskheader上bootau有效，那么该diskheader上存储。,2.yfs_diskstring最后一级支持*这样的通配符。,3. 关于增加4号文件达成一致。同意增加4号文件，用于存储diskgroup内disk信息，用于diskgroup内disk信息校验。不保证整个diskgorups的校验。4号文件入口在diskheader上记录。同1.,4。兼容性问题要考虑，可以本次暂不实现，需要给出升级逻辑。,方案通过,Posted by gaofengpu at 四月 26, 2024 11:28|
|---|
|  [](null)  ,时间：2024.5.7 10:30~11:30,地点：腾讯会议,与会人：trump，李银，吕雷奇，徐凡博，张茜，高风朴,议题：yfs支持磁盘发现详细设计串讲,  
,Posted by gaofengpu at 五月 07, 2024 11:47|
