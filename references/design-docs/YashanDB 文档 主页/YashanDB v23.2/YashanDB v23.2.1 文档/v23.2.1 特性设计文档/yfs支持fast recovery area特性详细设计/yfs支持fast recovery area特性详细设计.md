Created by 高风朴, last modified on 十月 15, 2024

IR链接：    [[YDBRD-21456] YFS 支持fast recovery area - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-21456)  

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-overview%E6%A6%82%E8%BF%B0)  

yfs元数据对yfs来说是及其重要的。如果yfs元数据损坏，yfs就无法对外提供服务。

YFS通过failgroup实现数据冗余，对元数据有冗余的的diskgroup来说，如果坏掉一份元数据，尚可通过备份修复。

但对于冗余度为external的diskgroup来说，元数据没有冗余。因此我们需要为冗余度为external级别的diskgroup提供元数据冗余。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

只针对冗余级别为external的diskgroup支持FRA功能。为该diskgroup的元数据提供冗余备份。元数据被破坏时，可以从FRA获取备份数据，并做自动恢复。

yfs快速恢复区是一块连续的，并且大小固定的区域。yfs每次元数据更新操作事务提交时，需要将事务更新前的内容按照顺序追加到快速恢复区。

快速恢复区大小固定，因此需要循环使用。

##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-interfaces%E6%8E%A5%E5%8F%A3)  

1. Yfs新增配置参数 YFS_FRA_ENABLE 用于设定是否开启快速恢复区。默认开启TRUE。
1. 创建external diskgroup时，默认创建快速恢复区。快速恢复区大小通过通过自己计算得出。fra_size=  1Mfra元数据区+bitmap双写区（au_size*4）+redo双写区(8M) +24Mblock双写区
1. 通过yfsminer查看快速恢复区（适配fra blocktype）    
  yfsminer -d yfs_disk_path -S au_size [-s block_size] [-u au_id] [-b block_id] [-t block_type]    
  另外，可以通过该命令查看快速恢复区meta信息


![](https://pingcode.yasdb.com/atlas/files/public/67396c578970c2af4f520b50/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBUUFBQUFFQUlBQUFBQWdBQUFnQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQkFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFRQUVBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAzNjcsImV4cCI6MTc4MjMxMTE2N30.kStYu9LDa2qTajzKlybDnHWGFgSfTrigcbkDdqti6hg)

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

并不能100%保证快速所有数据都能恢复。要求恢复内容在快速恢复区内。快速恢复区没有损坏。快速恢复区空间越大，能够冗余的的元数据越多。

快速恢复区的大小限制并不是十分严格的。实际创建的文件应该大于等于用户给定的大小。因为快速恢复区也是文件，必须满足yfs文件extent对齐。

快速恢复区的大小是固定的。一旦创建，不可以修改。快速恢复区是循环使用的。

FRA支持的元数据如下：

- [x] diskHeader           磁盘0号AU的0号block， diskheader需要至少两块盘   

- [x] PST                       磁盘1号AU的0号block   

- [x] bitmap                 一个bitmap大小为一个AU，个数根据实际磁盘容量计算。每个磁盘的3号AU开始   

- [x] 文件fileCtrl           1号文件内容，1~255 预留。用户文件fd为为256往后。   

- [x] 文件indirectFileCtrl       filectrl只能存文件前60个AU，超过60个，需要二级indirectFileCtrl。位置不一样，需要具体查文件的fileCtrl确定   

- [x] 目录文件              3号文件内容存储的是目录信息，大小根据用户创建的目录和文件数确定。   

- [x] redo文件              2号文件内容，大小8M。大小固定   

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

快速恢复区主要包含快速恢复区的设计，使用快速恢复区备份脏页，以及用快速恢复区恢复数据三个方面。

###   [5.1 ](https://conf.yasdb.com/pages/viewpage.action?pageId=135606185#51-architecture%E6%9E%B6%E6%9E%84)    快速恢复区设计

快速恢复区位于diskgroup内首块盘，位置为紧跟PST。即创建diskhead和pst后，区域为快速恢复区内容。创建快速恢复区后创建bitmap。

diskgroup内每块磁盘diskheader中要记录快速恢复区入口信息。

![](https://pingcode.yasdb.com/atlas/files/public/67396c57a1ad9a3311dc89be/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBUUFBQUFFQUlBQUFBQWdBQUFnQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQkFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFRQUVBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAzNjcsImV4cCI6MTc4MjMxMTE2N30.kStYu9LDa2qTajzKlybDnHWGFgSfTrigcbkDdqti6hg)

快速恢复区的总体布局如下：

首先是FRA元数据。大小1M。其中第一个block用于存储FRA总信息，如redo，bitmap和block双写区的offset， locationBlock的个数等。其余为locationBlock，用于记录block双写区中每个block的location信息。

其次是给redo预留的8M的空间，用于存放redo的冗余。

紧接着是bitmap的预留空间，bitmap预留空间大小为4个AU大小。循环覆盖写。

最后是快速恢复区block双写区，一个block存放一个yfs元数据block，用作yfs元数据block的副本。

#### 5.1.1 快速恢复区元数据（FRA元数据）

一个YfsBlockLoc唯一确定diskgroup内一块磁盘的位置。元数据区按照YfsBlockLoc密集存储。存储YfsBlockLoc的位置信息，即代表了其在冗余区的具体位置。

对diskheader， pst， bitmap，用YfsBlockLoc记录其diskid与blockid。

对fileCtrl， indirectFileCtrl， redo， 目录文件记录其fd与blockid。（但在superfile记录时也用的是fd+blockid，但是在恢复时，需要转换为disk+blockid。）

#### 5.1.2 快速恢复区各部分内容大小

fra元数据区，预留1m，实际使用大小根据具体fra_size和au_size计算获得。（如fra_size最大161M，au_size 1M，则block双写区大小为：161-1-8-4=148M，共37888个block。一个fra元数据block可以存202个blocklocation信息，共需要187个block+一个headblock，共188个block。1M足够）

FRA redo大小：FRA_REDO_SIZE=8M

bitmap区大小：固定4个AU大小

剩下为Block冗余区。

###   [5.2 ](https://conf.yasdb.com/pages/viewpage.action?pageId=135606185#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)    FRA 接口设计

#### 5.2.1 格式化FRA

1. 根据参数，计算实际FRA大小。
1. 创建FRA区
1. 并将FRA入口写入dg内每一个diskHead中。


注：仅支持创建diskgroup的同时创建fra。

#### 5.2.2启动加载

1. yfs启动时：mount时加载所有的diskHeader，找到FRA的入口。加载FRA，加载失败报错
1. yfs备升主时：通过diskHeader找到FRA入口，加载FRA，加载失败报错。


#### 5.2.3 往FRA中写入脏页流程

1. 根据写入的数据类型，申请FRA空间信息，计算应该在FRA中写入位置。
1. 更新FRA meta信息（刷盘）， 然后脏页写入FRA。


#### 5.2.4 从FRA中读取脏页流程

1. 根据要读取的locator信息，在元数据中查找，如果存在，定位脏页位置，读取脏页返回。 如果不存在，则返回错误。


#### 5.2.5 往fra写入数据时机    
    


block数据写入时机有两个时机：    
  1.创建diskgorup时，需要将diskhead， pst， 以及一号文件、dir文件 、redo文件，fileCtrl同时写入fra。

2. 原子操作结束时，通过yfscommit流程，将元数据写入快速恢复区。

原yfs commit流程做如下修改：    


![](https://pingcode.yasdb.com/atlas/files/public/67396c57a1ad9a3311dc89bf/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBUUFBQUFFQUlBQUFBQWdBQUFnQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQkFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFRQUVBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAzNjcsImV4cCI6MTc4MjMxMTE2N30.kStYu9LDa2qTajzKlybDnHWGFgSfTrigcbkDdqti6hg)

#### 5.2.6 从fra读取数据用于修复

在yfs启动时：首先通过查找diskhead中fra的入口信息，加载FRA，成功后，如果在加载YFS元数据时，发现数据损坏，则从快速恢复区查找，如果找到则修复，并打印日志。如果找不到，直接报错。

###   [5.3 Compatibility（兼容性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#53-compatibility%E5%85%BC%E5%AE%B9%E6%80%A7)  

不考虑23.1兼容性问题

###   [5.4 DFX设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#54-dfx%E8%AE%BE%E8%AE%A1)  

不涉及

###   [5.5 其他](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#55-%E5%85%B6%E4%BB%96)  

无

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

|破坏文件内容|前提|预期|
|---|---|---|
|diskheader|有冗余|修复后正常|
|pst|有冗余|修复后正常|
|bitmap|有冗余|修复后正常|
|filectrl|有冗余|修复后正常|
|directfileCtrl|有冗余|修复后正常|
|redo文件|有冗余|修复后正常|
|目录文件|有冗余|修复后正常|
|冗余区|无|正常启动|


##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

配置参数：有新增配置参数

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*暂无*

## Attachments:

[image2023-11-18_12-30-21.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTY4OTcwYzJhZjRmNTIwYjQ3IiwicmVmX2lkIjoiNjczOTZjNTY1OTNmOTljOWZmMjM2ZGI1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzY3LCJleHAiOjE3ODIzODY3Njd9.U_JCo6mdBSOSNUmiJfrDo_36t3ipx1R0MYcXZFUbsrw)

 (image/png)    


[image2023-11-18_15-55-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTZhMWFkOWEzMzExZGM4OWI2IiwicmVmX2lkIjoiNjczOTZjNTY1OTNmOTljOWZmMjM2ZGI1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzY3LCJleHAiOjE3ODIzODY3Njd9.ZjwOKJYuW1JsFF9b7YvUXm5SyJAZgQ8tMhKCqzNaYDs)

 (image/png)    


[image2023-11-18_16-2-50.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTZhMWFkOWEzMzExZGM4OWI3IiwicmVmX2lkIjoiNjczOTZjNTY1OTNmOTljOWZmMjM2ZGI1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzY3LCJleHAiOjE3ODIzODY3Njd9.qMSn3SG-BnUxlBbLoVrzFayzj0d06MMjzSlUvBAhm_M)

 (image/png)    


[image2023-11-18_16-7-3.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTY4OTcwYzJhZjRmNTIwYjQ4IiwicmVmX2lkIjoiNjczOTZjNTY1OTNmOTljOWZmMjM2ZGI1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzY3LCJleHAiOjE3ODIzODY3Njd9.OAZvsCCsZIe_Cr8enEjYgbw7nimthbobeWfNgeVIExQ)

 (image/png)    


[image2023-11-18_16-14-40.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTY4OTcwYzJhZjRmNTIwYjQ5IiwicmVmX2lkIjoiNjczOTZjNTY1OTNmOTljOWZmMjM2ZGI1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzY3LCJleHAiOjE3ODIzODY3Njd9.HZnCu24SGEBBvmloaiN3JxCKXyJL5Y9w7vv8PnUBkmg)

 (image/png)    


[image2023-11-20_18-45-17.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTZhMWFkOWEzMzExZGM4OWI4IiwicmVmX2lkIjoiNjczOTZjNTY1OTNmOTljOWZmMjM2ZGI1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzY3LCJleHAiOjE3ODIzODY3Njd9.7C83kCpsXeujaRDGK1MT8dMRFPiwXzldOO10sirX48M)

 (image/png)    


[image2023-11-20_18-56-17.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTZhMWFkOWEzMzExZGM4OWI5IiwicmVmX2lkIjoiNjczOTZjNTY1OTNmOTljOWZmMjM2ZGI1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzY3LCJleHAiOjE3ODIzODY3Njd9.PVk15IJCmxwHj1MXJyUbjwqY4JFC4GPjM0K9QueyC14)

 (image/png)    


[image2023-11-20_20-23-33.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTY4OTcwYzJhZjRmNTIwYjRhIiwicmVmX2lkIjoiNjczOTZjNTY1OTNmOTljOWZmMjM2ZGI1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzY3LCJleHAiOjE3ODIzODY3Njd9.mcl8DWy_d8xvanYXga1GHR-05JMCsYOTaCXuVqSQ-iM)

 (image/png)    


[image2023-11-20_20-58-10.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTY4OTcwYzJhZjRmNTIwYjRiIiwicmVmX2lkIjoiNjczOTZjNTY1OTNmOTljOWZmMjM2ZGI1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzY3LCJleHAiOjE3ODIzODY3Njd9.QRqKIrbXE389oXeb77szeNvU2I2wSPFRubEUXOQnQ_Y)

 (image/png)    


[image2023-11-20_21-2-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTY4OTcwYzJhZjRmNTIwYjRjIiwicmVmX2lkIjoiNjczOTZjNTY1OTNmOTljOWZmMjM2ZGI1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzY3LCJleHAiOjE3ODIzODY3Njd9.MQYcND7taDQ0AvsqbvRLev4fB2_UbS_69XqrE_80uPI)

 (image/png)    


[image2023-11-21_14-16-28.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTZhMWFkOWEzMzExZGM4OWJiIiwicmVmX2lkIjoiNjczOTZjNTY1OTNmOTljOWZmMjM2ZGI1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzY3LCJleHAiOjE3ODIzODY3Njd9.mvC7_Nmc2zNiaEWctLWQNxisftqFxoTj0ZAeTDAjI8o)

 (image/png)    


[image2023-11-21_15-14-49.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTY4OTcwYzJhZjRmNTIwYjRkIiwicmVmX2lkIjoiNjczOTZjNTY1OTNmOTljOWZmMjM2ZGI1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzY3LCJleHAiOjE3ODIzODY3Njd9.rx3-3uhc_4XC1wviCOGrgsW_0PwfVSLfSoBfWYLZw6g)

 (image/png)    


[image2023-11-22_11-21-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTY4OTcwYzJhZjRmNTIwYjRlIiwicmVmX2lkIjoiNjczOTZjNTY1OTNmOTljOWZmMjM2ZGI1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzY3LCJleHAiOjE3ODIzODY3Njd9.guG0kB_ugzDdulGHlYMTpWM9rl0gUS9O9ZEEMKudZyk)

 (image/png)    


[image2024-1-24_10-3-24.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTdhMWFkOWEzMzExZGM4OWJjIiwicmVmX2lkIjoiNjczOTZjNTY1OTNmOTljOWZmMjM2ZGI1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzY3LCJleHAiOjE3ODIzODY3Njd9.b2BLJdR07fDyha015AEuho4eg3Wl1baXtaKJxgSrOvE)

 (image/png)    


## Comments:

|  [](null)  ,快速恢复区主要解决的是冗余度不够的情况下，降级实现一定程度的 “冗余”，比如只有 1 块盘 或者 1 个 FG，在 1块盘或 1个 FG 内保存元数据的多个副本。,当 DG 处于低冗余度时，是否可以直接复用 YFS 现有的多副本能力：,1. YFS 虚拟元文件直接在 DG 内实现多降级的副本，
,- 如只有 1 个盘，那么虚拟元文件的 partner ship 为： 自身 + 自身 + 自身
- 如只有 1 个 FG 多个盘，那么虚拟元文件的 partner ship 为同组的其他磁盘，如磁盘不够，partner 中可能包含重复的磁盘。
,1. 如此只有磁盘元数据：diskHead、pst、bitmap 不受多副本保护，新增一个虚拟元文件，作为磁盘元数据的快速恢复区，该虚拟元文件也遵守 1 中的多副本策略。
,这样的好处：,1. 逻辑上自洽，YFS 无需太多新机制，即可保证元数据的冗余度，简化开发。
1. 元文件即使在低冗余度时，也具备一定的修复能力。
1. 由于虚拟元文件扩展时实时分配空间，避免集中读写特定区域造成的硬件损坏。
1. 只需要处理 bitmap 的快速恢复，FRA 的实现会非常简单。
,Posted by mayong at 十一月 21, 2023 15:41|
|---|
|  [](null)  ,需要提供断点能力：,1、断点1，创建FRA文件失败，报错；,2、断点2，  dg内所有磁盘的diskHeader和PST写入FRA文件失败，报错；,3、断点3，redo内容写入FRA失败，报错,4、断连4，  FRA 校验失败，清空FRA内容，报错；,5、  断点5，  diskHeader、pst、bitmap数据校验失败，打印error日志报错，FRA查找冗余数据，并修复，执行成功；,6、断点6、加载目录树时，元数据校验失败，打印error日志报错，在FRA中找备份数据，并修复，执行成功；,7、断点7、FRA空间占满，立即触发回收，打印日志；,Posted by lvleiqi at 一月 11, 2024 20:19|
