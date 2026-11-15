import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 12 },
  section: { margin: 10, padding: 10 },
  title: { fontSize: 24, marginBottom: 10 },
});

export const InvoicePdfDocument = ({ tenantName, clientName, monthRef, durationSeconds, amountCents }: any) => (
  <Document>
    <Page style={styles.page}>
      <View style={styles.section}>
        <Text style={styles.title}>TrackFlow Fatura</Text>
        <Text>Empresa: {tenantName}</Text>
        <Text>Cliente: {clientName}</Text>
        <Text>Período: {monthRef}</Text>
      </View>
    </Page>
  </Document>
);
