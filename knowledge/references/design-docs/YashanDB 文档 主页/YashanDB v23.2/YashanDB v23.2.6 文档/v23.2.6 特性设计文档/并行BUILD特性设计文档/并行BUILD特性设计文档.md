Created by 张旭涛, last modified on 九月 12, 2024

  


  


* IR链接：*    [https://pingcode.yasdb.com/ship/ideas/66a0b0214283cf23d4f25a37](https://pingcode.yasdb.com/ship/ideas/66a0b0214283cf23d4f25a37)    *?*    
  *#YASHAN-3006 分布式支持并行创建备库*

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/66bdc9338f5ee191734e24b5](https://pingcode.yasdb.com/pjm/items/66bdc9338f5ee191734e24b5)    *?*    
  *#YDBRD-31646 支持并行创建备库*

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#1-%E6%80%BB%E8%BF%B0)  

主备支持并行build，提升建立备库效率。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

分布式

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

**无参考项，内部优化**

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

  


优势：

1. 网络IO性能较好的环境下，并行BUILD能有效提高建库速率。
1. slice文件多为碎片小文件，IO占用小，文件操作、文件网络IO确认效率较低。提高并行度对该文件提升较大。


劣势：

1. 网络受限的环境提升并行度对BUILD操作无提升。
1. 提升并行度，主备之间的资源消耗较大。
1. 主备磁盘IO速度差异容易造成网络IO阻塞超时。此时提升并行度对BUILD速率也明显提升。


##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#2-%E6%8E%A5%E5%8F%A3)  

  


1. 用户指定并行连接数，默认 4  上限 8.  
    1. build database [parallelism  count]
    1. build database to standby （*） [parallelism  count]


  


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

  


假设存在32个备机，同时执行并行BUILD，主机的主备链路上限不能超。

  


##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#4-%E7%89%B9%E6%80%A7)  

  


***10GB下  build 单线程 lineitem测试  ***

|  
|slice大小|导入耗时(s)|同步耗时(4线程)(s)|build耗时(s)|文件总数|文件总大小|平均build速度(MB/s)|平均build速度(文件个数/s)|备份时间（s）,8并行|
|:---|:---|:---|:---|:---|:---|:---|:---|---|:---|
|2|256K|50|19|114|7887|3.1G|28.51|69|30|
|3|64k|80|71|354|30558|3.2G|9.47|86|  
|
|6|16k（slice layout）|217|292|121|7338|3.2G|27.73|60|45|
|4|16k|206|291|1370|121077|3.5G|2.67|88|240|
|5|4K|660|1091|5440|483516|4.9G|0.94|88|  
|
|1|2M|60|19|98|1302|3.1G|33.17|13|  
|


自测性能

|  
|slice大小|导入耗时(s)|并发线程数|build耗时(s)|文件总数|文件总大小|平均build速度(MB/s)|平均build速度(文件个数/s)|
|:---|:---|:---|:---|:---|:---|:---|:---|---|
|4|16k|  
|8|3907|2086523|17102048 (17 G)|4,3|534|
|  
||  
|  
|  
|  
|  
|  
|  
|


###   [4.1 特性设计](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

  


#### 提高并行度优化

假设并行度为 P。  主机端开 P个线程负责读写文件。 每个线程绑定 n个链路（n为备机节点的个数）。 每读取一个文件执行备份时候，该线程都需要将自己负责备份的文件发送至所有备机后，才表示执行完成。

  


![](https://pingcode.yasdb.com/atlas/files/public/67396e098970c2af4f52166b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFnQUFBQ0FBQUFBQUJBQUFBQUFDQUFBQUFBZ0FCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM3NjUsImV4cCI6MTc4MjMyNDU2NX0.Wu2TP2VJysPyCxY-2UnuQR1j37jWDWRXoCM1b_XKImU)

  


每个线程上分配的数据文件完全发送给所有备机之后 ，该线程的工作任务算作完成，等待下一轮文件任务。

  


###   [4.2 特性功能点2](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)  

slice文件build最大性能优化：

选取什么并行度下的场景才能最大契合 多slice文件的并行备份场景。

  


  


  


slice文件消耗时间点：

1. 主机端文件句柄开启、关闭。备机端文件开启、写文件、关文件，均为串行，实际文件的数据量并不大。
1. 实际网络IO压力并不大，磁盘IO负载也不高


  


优化点：

1. slice文件夹打包BUILD，  备机端需要解包
    1. 小文件打包，可全部存入固定大小的buffer中一并发送
    1. 文件夹的文件超过buffer大小的文件需打包多次、直至发送完成。


  


  


#### 如何打包：

将每个slice文件夹分配给子工作线程，由子工作线程打包slice文件，一次性open所有文件，组装buffer设置为 8MB，组装文件至buffer之后统一发送。直至该线程负责的文件夹发送完毕。

  


buffer结构

  


bufferhead

CodUint32  filecount；

```
bufferhead
{
CodUint32   totalsize;
CodUint32  filecount；

}；

filehead{
CodChar[256] filename；
Coduint32 filesize；

}
```

  


![](https://pingcode.yasdb.com/atlas/files/public/67396e098970c2af4f52166c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFnQUFBQ0FBQUFBQUJBQUFBQUFDQUFBQUFBZ0FCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM3NjUsImV4cCI6MTc4MjMyNDU2NX0.Wu2TP2VJysPyCxY-2UnuQR1j37jWDWRXoCM1b_XKImU)

  


#### 如何解包：

备机端线程读取到数据至buffer之后，逐一解析并写入文件。

  


##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

1. 主备网络IO限速测试
1. 主备磁盘IO速率差异测试
1. 主备正常场景build性能测试


  


  


##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

## Comments:

|  [](null)  ,与会人：马志宏、张旭涛、高亚宁、赵楠,会议时间：2024.09.13    
  会议地点：线下会议,会议纪要：,1.着重单机build性能测试，测试其他关于build功能的稳定性,  
,Posted by zhangxutao at 九月 14, 2024 14:36|
|---|
