Created by 张周玺, last modified on 三月 25, 2024

## 一、协议格式

  [u - 史鑫 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/~shixin/u#u-%E5%8D%8F%E8%AE%AE)  

## 二、被使用场景

  


驱动和服务端 解析或者编码UDT类型的数据。

## 三、接收发送流程

查询过程：服务端发给驱动端时是lob传输。

插入过程：驱动传给服务端是stream传输。

## 四、异常场景排查拦截

解析之前会对type的toid，元数据等进行校验。

## 五、跨包支持情况

不是底层协议，跨包问题由lob类型或者stream协议去保证

## 六、anlStmt相关字段

不涉及

## 七、完成情况

已完成