Created by 高风朴, last modified on 十月 15, 2024

  [[YDBRD-21454] YFS支持drop/truncate file后的资源回收 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-21454)  

## 1. Overview（概述）

当前YFS实现中，对文件truncate， 删除，目录删除后空间依旧保留。导致使用时，如果重复的删除、重建目录/文件，导致空间爆炸。对磁阵，YFS共享内存都有挑战。需要在文件目录删除后，将空间及时回收。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

文件或者目录被删除后，所占用磁盘空间和内存空间被释放。

FAT资源回收，可以通过查询v$yfs_disk视图,观察  FREE_MB值变化  （参考文档    [YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.1/zh/%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E7%B3%BB%E7%BB%9F%E8%A7%86%E5%9B%BE/%E5%8A%A8%E6%80%81%E8%A7%86%E5%9B%BE/V$YFS_DISK.html)    ）

或者通过GV$YFS_DISK视图查看FREE_MB值变化（GV视图待实现，需要实现的GV视图为：GV$YFS_DISKGROUP,  GV$YFS_DISK, GV$YFS_FAILGROUP, GV$_YFS_FILE共四个）

dir信息被回收，可以通过yfscmd 命令查看回收站内容得知（新增功能）如：yfscmd -D $PWD  ls +dg0/recyclebin

##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-interfaces%E6%8E%A5%E5%8F%A3)  

**从db角度看，涉及接口**  ：

1. 删除datafile： 
    1. drop tablespace xxx including contents and datafiles;
    1. alter tablespace xxx drop datafiles aaa;
1. 删除redo(未支持)
1. 删除归档（未支持）
1. 删除备份文件（未支持）


  


**从yfscmd角度看，涉及接口**  ：

truncate

rm

ls +dg0/recyclebin  (新增查看回收站功能)

  [yfscmd的命令使用文档](https://cod-doc.yasdb.com/yashandb/23.1/zh/%E5%B7%A5%E5%85%B7%E6%89%8B%E5%86%8C/yfscmd/%E6%96%87%E4%BB%B6%E7%AE%A1%E7%90%86%E5%91%BD%E4%BB%A4.html)  

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

业界对文件系统删除有两种操作：

1. 同步回收资源：执行删除命令时，文件系统同步将文件和目录所占用空间同步释放。     
  优点：实现简单    
  缺点：文件一旦被删，无法恢复
1. 延迟回收资源：执行删除命令时，只是在文件系统打标记删除。只有在系统资源不足或者用户主动触发时，才会将文件所占用空间真正释放。如window文件系统    
  优点：删除文件时，并不是真正意义上删除。事后可以通过还原命令，将文件恢复回来。    
  缺点：实现起来较复杂一些。


我们调研oracle ASM 发现。oracle 采用的是第一种。

在使用asmcmd删除文件时，asm能保证db已经不用该文件了。当前yfscmd在删除文件时，无法确保删除的文件db不再使用。

YFS在原型上选择的是第二种，且YFS实现与ASM有本质区别。大家知道ASM借用了很多oracleDB的代码框架，因此，在删除ASM文件时，asm可以保证，db在使用的文件，无法删除。而YFS实现上，不能保证db正在使用的文件被删除。基于此，yfs采用延迟回收的技术。如果用户误删，一定条件下，可以补救。

  


yfs提供四个参数：    
  RECY_INTERVAL：执行资源回收时-文件删除时间>RECY_INTERVAL. 文件方可回收。单位秒，取值范围 [0, 无穷大）该参数支持在线修改。默认值3天。

RECY_TASK_INTERVAL：上次执行资源回收扫描任务距离下次执行扫描任务时间间隔。单位秒，取值 [600, 24*60*60）该参数不易过小。最小10分钟。过小容易导致不停扫描磁盘，造成系统性能下降。该参数不支持在线修改。默认值1小时。

RECY_UPPER_THRESHOLD：资源回收上限。取值为[0,100)  表示磁盘容量百分比达到该阈值时，触发资源回收。  该参数支持在线修改。默认值80.

RECY_LOWER_THRESHOLD：资源回收下限，取值为[0,100)  表示资源回收过程中，已经低于该阈值，但回收站中还有内容可回收，但停止回收。该参数支持在线修改。默认值20.

  


延迟回收时，需要在以下几个条件时触发：

1. 分配空间时，发现磁盘空间满。此时触发。
1. 配置参数设置有磁盘容量使用阈值，yfs回收任务定时触发，定时扫描磁盘容量，如果超过阈值。则触发回收。回收时，每回收一个文件，检查磁盘容量是否到达磁盘空间健康阈值。如果达到，则不再回收（即便回收站中还有待回收资源）。否则，继续回收。（将文件或者目录从磁盘上抹去时记录INFO日志）


被回收的文件要求：当前时间-文件deletetim > recycle_interval 

  


yfs提供配置参数命令，如：    
  alter system set param =xxx;

但是该命令修改后，配置参数只能在本实例生效，且不会存入本实例配置文件。

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

23.1yfs采用延迟回收机制。相较于asm，yfs采用延迟回收机制，更能保证db数据安全。

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#51-architecture%E6%9E%B6%E6%9E%84)  

![](https://pingcode.yasdb.com/atlas/files/public/67396c558970c2af4f520b45/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFDQUFBQ0FBQUFBQUFBQUFBQUNBQUFBUUFBQUVBQUFFQUFBb0FBQUFBQUFBQUFBQUFBQUFBQWdBQUFnQUFCQUFBSUFBQUFRZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQ0FBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAzNTYsImV4cCI6MTc4MjMxMTE1Nn0.vgkOpileeMCZXOJtVMWkV9uSWkFXUjQQz2snwcJlo_I)

#### 延迟回收涉及的流程

删除流程：

业务侧通过yfscmd或者YashanDB发起删除文件目录。

YFS在目录树中找到对应的文件或者目录信息，标记删除，将其放入回收站。

回收流程：

当业务操作时，发现磁盘空间不足，或者业务主动发起清理回收站时，触发清理回收站流程。

YFS将回收站中符合回收条件的文件、目录所占资源回收释放。还给磁盘和内存。

再利用流程：

业务在请求yfs新建文件、目录或者扩展文件时，将回收的磁盘和内存重新利用。

删除和再利用流程已经实现，本次主要考虑回收流程

  


**回收设计的内容如下：**

回收文件：

1. 文件内容所占用磁盘空间，即FAT
1. 文件dir信息所占用磁盘空间
1. 文件FAT和dir信息所占用内存空间


回收目录：

1. 目录dir信息所占用磁盘空间
1. dir信息所占用内存空间


###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

总体回收流程：

![](https://pingcode.yasdb.com/atlas/files/public/67396c55a1ad9a3311dc89b4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFDQUFBQ0FBQUFBQUFBQUFBQUNBQUFBUUFBQUVBQUFFQUFBb0FBQUFBQUFBQUFBQUFBQUFBQWdBQUFnQUFCQUFBSUFBQUFRZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQ0FBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAzNTYsImV4cCI6MTc4MjMxMTE1Nn0.vgkOpileeMCZXOJtVMWkV9uSWkFXUjQQz2snwcJlo_I)

回收FAT流程：

![](https://pingcode.yasdb.com/atlas/files/public/67396c558970c2af4f520b46/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFDQUFBQ0FBQUFBQUFBQUFBQUNBQUFBUUFBQUVBQUFFQUFBb0FBQUFBQUFBQUFBQUFBQUFBQWdBQUFnQUFCQUFBSUFBQUFRZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQ0FBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAzNTYsImV4cCI6MTc4MjMxMTE1Nn0.vgkOpileeMCZXOJtVMWkV9uSWkFXUjQQz2snwcJlo_I)

回收dir流程：

![](https://pingcode.yasdb.com/atlas/files/public/67396c55a1ad9a3311dc89b5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFDQUFBQ0FBQUFBQUFBQUFBQUNBQUFBUUFBQUVBQUFFQUFBb0FBQUFBQUFBQUFBQUFBQUFBQWdBQUFnQUFCQUFBSUFBQUFRZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQ0FBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAzNTYsImV4cCI6MTc4MjMxMTE1Nn0.vgkOpileeMCZXOJtVMWkV9uSWkFXUjQQz2snwcJlo_I)

###   [5.3 Compatibility（兼容性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#53-compatibility%E5%85%BC%E5%AE%B9%E6%80%A7)  

不涉及兼容性问题。

###   [5.4 DFX设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#54-dfx%E8%AE%BE%E8%AE%A1)  

不涉及

###   [5.5 其他](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#55-%E5%85%B6%E4%BB%96)  

**不涉及**

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

|测试场景|前置条件|预期|实际结果|测试是否通过|
|:---|:---|:---|:---|:---|
|truncate接口|yfs正常启动，truncate size小于文件size|报错|  
|  
|
|  
|truncate size等于filesize|成功返回|  
|  
|
|  
|truncate size 大与fileSize，但无需扩展extent（如文件大小为6.5M， truncatesize 为6.8M）|仅更新文件size后返回|  
|  
|
|  
|truncate size大于filesize，需要扩展extent（如文件大小为6.5m。truncatesize 未20M）|扩展extent后，更新size返回|  
|  
|
|  
|truncate size远大于filesize。（如文件大小为6.5m。truncate size未1T）|扩展extent后，更新size返回|  
|  
|
|ls dg/recyclebin|  
|展示回收站内文件，目录|  
|  
|
|文件extend操作时，无可用空间|回收站内有内容，可供回收资源充足|触发资源回收，资源回收后，继续extend文件|  
|  
|
|  
|回收站内有内容，但可供回收资源不足|资源回收线程被触发，但无资源被回收，扩展文件失败|  
|  
|
|  
|回收站内无内容|资源回收线程被触发，但无资源被回收，扩展文件失败|  
|  
|
|回收相关参数设置|动态设置参数|系统正常，可通过查看命令，查看设置后的参数|  
|  
|
|  
|查看回收参数|系统正常，数据正常显示|  
|  
|


##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

1. yfscmd中关于ls章节修改
1. yfs exec命令动态修改参数和查看
1. yfs配置文件章节
1. 视图修改


##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

方案一：对于已删除，未回收的文件，做快速恢复。

## Attachments:

[image2023-10-17_11-56-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTVhMWFkOWEzMzExZGM4OWFkIiwicmVmX2lkIjoiNjczOTZjNTU3MjgyMDZlZmI5MmYxMGUyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzU2LCJleHAiOjE3ODIzODY3NTZ9.tK9iJuxDhft2kOXYvtXpjymwAkeZXwj7NAdrNEA0Xgk)

 (image/png)    


[image2023-10-17_14-27-17.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTU4OTcwYzJhZjRmNTIwYjQxIiwicmVmX2lkIjoiNjczOTZjNTU3MjgyMDZlZmI5MmYxMGUyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzU2LCJleHAiOjE3ODIzODY3NTZ9.4xavUcflzn37SahHpJzTY-MHPOY-qd14ihi7CfIUozY)

 (image/png)    


[image2023-10-17_14-31-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTVhMWFkOWEzMzExZGM4OWFlIiwicmVmX2lkIjoiNjczOTZjNTU3MjgyMDZlZmI5MmYxMGUyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzU2LCJleHAiOjE3ODIzODY3NTZ9.KZC4RlCII5r4psf9a5mtf0s_WLD5HdrgmgLMa8VBXmc)

 (image/png)    


[image2023-10-17_16-4-39.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTU4OTcwYzJhZjRmNTIwYjQyIiwicmVmX2lkIjoiNjczOTZjNTU3MjgyMDZlZmI5MmYxMGUyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzU2LCJleHAiOjE3ODIzODY3NTZ9.2PhMz2BalPFoID516SYXUhNJL0qfV7DTyGrOjQnlKOM)

 (image/png)    


[image2023-10-17_16-23-19.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTVhMWFkOWEzMzExZGM4OWFmIiwicmVmX2lkIjoiNjczOTZjNTU3MjgyMDZlZmI5MmYxMGUyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzU2LCJleHAiOjE3ODIzODY3NTZ9.aUZORWn6rVWp81GaFGDWcdGygJgux_uventhUDchy74)

 (image/png)    


[image2023-10-20_11-21-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTU4OTcwYzJhZjRmNTIwYjQzIiwicmVmX2lkIjoiNjczOTZjNTU3MjgyMDZlZmI5MmYxMGUyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzU2LCJleHAiOjE3ODIzODY3NTZ9.Uy5ZAQ_TzWPfe6r9Ozvc6w-YpIQDH6QkkAS1DzU3FBY)

 (image/png)    


[image2023-10-20_14-26-17.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTVhMWFkOWEzMzExZGM4OWIzIiwicmVmX2lkIjoiNjczOTZjNTU3MjgyMDZlZmI5MmYxMGUyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzU2LCJleHAiOjE3ODIzODY3NTZ9.i7dlMp3m9oCAqm6ixerVmrV22OwbHSNu4_kkjCQhMdc)

 (image/png)    


## Comments:

|  [](null)  ,结论：,采用方案1，即延迟回收,触发回收的两种情况：    
  1. 分配空间时，空间满,2. 内部定时任务，发现空闲空间占比小于阈值。另外，时间在预定回收时间段内。,  
,清理时，不能全部回收，应该有下线阈值。到达阈值不再清理。,回收时，没有回收失败情况，将原子操作可以扩大，加速回收。,参数要求通过yfscmd配置。实时生效。,Posted by gaofengpu at 十月 23, 2023 19:38|
|---|
